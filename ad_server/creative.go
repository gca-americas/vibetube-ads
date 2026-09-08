package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/oauth2/google"
)

func getGeminiModel() string {
	if m := os.Getenv("GEMINI_MODEL"); m != "" {
		return m
	}
	return "gemini-3.8-flash"
}

func getGeminiImageModel() string {
	if m := os.Getenv("GEMINI_IMAGE_MODEL"); m != "" {
		return m
	}
	return "gemini-3.1-flash-image"
}

type CreativePromptPayload struct {
	Prompt string `json:"prompt"`
}

func (s *Server) HandleGenerateCreative(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload CreativePromptPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("GCP_PROJECT_ID")
	}
	if projectID == "" {
		projectID = os.Getenv("DEVSHELL_PROJECT_ID")
	}
	if projectID == "" {
		projectID = "vibeflix-sandbox"
	}
	location := os.Getenv("VERTEX_AI_LOCATION")
	if location == "" {
		location = "us-central1"
	}

	title := "Apex Innovation"
	banner := "Engineered for next-generation performance."
	category := "tech"
	imageData := ""

	// Derive smart initial defaults from the prompt in case Vertex AI is unreachable or restricted on GCP
	if payload.Prompt != "" {
		pLower := strings.ToLower(payload.Prompt)
		if strings.Contains(pLower, "processor") || strings.Contains(pLower, "blend") || strings.Contains(pLower, "food") || strings.Contains(pLower, "kitchen") || strings.Contains(pLower, "cook") || strings.Contains(pLower, "smoothie") {
			title = "Aura Pulse Blender"
			banner = "High-torque precision vortex blending with smart pulse extraction."
			category = "tech"
		} else if strings.Contains(pLower, "shoe") || strings.Contains(pLower, "sneaker") || strings.Contains(pLower, "kicks") || strings.Contains(pLower, "run") {
			title = "Neon Velocity X"
			banner = "Illuminate your run. Ultra-responsive cushioning."
			category = "fashion"
		} else if strings.Contains(pLower, "game") || strings.Contains(pLower, "gaming") || strings.Contains(pLower, "vr") || strings.Contains(pLower, "cyber") || strings.Contains(pLower, "headset") {
			title = "CyberPulse Elite"
			banner = "Zero latency. Pure tactical immersion."
			category = "gaming"
		} else if strings.Contains(pLower, "coffee") || strings.Contains(pLower, "drink") || strings.Contains(pLower, "brew") {
			title = "VoltNitro Brew"
			banner = "Supercharge your day with cold-extracted energy."
			category = "fashion"
		} else if strings.Contains(pLower, "watch") || strings.Contains(pLower, "smartwatch") || strings.Contains(pLower, "wearable") {
			title = "AeroPulse Chrono"
			banner = "Aerospace titanium casing with holographic biometric sync."
			category = "tech"
		} else if strings.Contains(pLower, "keyboard") || strings.Contains(pLower, "keycap") || strings.Contains(pLower, "switch") {
			title = "Luminosity GX"
			banner = "Optical switches with per-key RGB aurora illumination."
			category = "gaming"
		} else {
			words := strings.Fields(payload.Prompt)
			if len(words) > 0 {
				title = strings.Title(strings.Join(words[:min(3, len(words))], " "))
				banner = fmt.Sprintf("Next-generation %s for modern lifestyles.", strings.ToLower(title))
			}
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	// Authenticate to Vertex AI using Google Application Default Credentials (ADC)
	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err == nil && creds != nil {
		if creds.ProjectID != "" && (projectID == "" || projectID == "vibeflix-sandbox") {
			projectID = creds.ProjectID
		}
		tokenSource := creds.TokenSource
		tok, err := tokenSource.Token()
		if err == nil && tok.AccessToken != "" {
			token := tok.AccessToken

			// 1. Generate Title, Tagline, & Category with Gemini on Vertex AI (with model cascade)
			textModels := []string{getGeminiModel()}
			for _, m := range []string{"gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"} {
				if !contains(textModels, m) {
					textModels = append(textModels, m)
				}
			}

			for _, model := range textModels {
				var geminiUrl string
				if strings.HasPrefix(model, "gemini-3") || location == "global" {
					geminiUrl = fmt.Sprintf("https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/google/models/%s:generateContent", projectID, model)
				} else {
					geminiUrl = fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent", location, projectID, location, model)
				}
				geminiPrompt := fmt.Sprintf(`You are an expert creative director for Vibetube video ads. Based on the user prompt: '%s', determine if a specific product title or brand name was explicitly specified. If specified, use that exact title. Otherwise, generate a snazzy, punchy product title (under 20 chars). Also generate a compelling ad tagline (under 45 chars), and select category ('gaming', 'fashion', or 'tech'). Respond ONLY with a valid JSON object with keys 'title', 'description', 'category'. No markdown.`, payload.Prompt)

				geminiReqPayload := map[string]interface{}{
					"contents": []map[string]interface{}{
						{
							"role": "user",
							"parts": []map[string]interface{}{
								{"text": geminiPrompt},
							},
						},
					},
					"generationConfig": map[string]interface{}{
						"responseMimeType": "application/json",
					},
				}

				bytesReq, err := json.Marshal(geminiReqPayload)
				if err != nil {
					continue
				}

				req, err := http.NewRequestWithContext(ctx, "POST", geminiUrl, bytes.NewBuffer(bytesReq))
				if err != nil {
					continue
				}

				req.Header.Set("Authorization", "Bearer "+token)
				req.Header.Set("Content-Type", "application/json")
				client := &http.Client{Timeout: 15 * time.Second}
				resp, err := client.Do(req)
				if err != nil {
					continue
				}

				bodyBytes, _ := io.ReadAll(resp.Body)
				resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					var geminiResp struct {
						Candidates []struct {
							Content struct {
								Parts []struct {
									Text string `json:"text"`
								} `json:"parts"`
							} `json:"content"`
						} `json:"candidates"`
					}
					if err := json.Unmarshal(bodyBytes, &geminiResp); err == nil && len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
						var parsed struct {
							Title       string `json:"title"`
							Description string `json:"description"`
							Category    string `json:"category"`
						}
						if err := json.Unmarshal([]byte(geminiResp.Candidates[0].Content.Parts[0].Text), &parsed); err == nil {
							if parsed.Title != "" {
								title = parsed.Title
							}
							if parsed.Description != "" {
								banner = parsed.Description
							}
							if parsed.Category != "" {
								category = parsed.Category
							}
							log.Printf("[creative] Successfully generated copy with Vertex AI text model %s: '%s'", model, title)
							break
						}
					}
				} else {
					log.Printf("[creative] Vertex AI text generation error for %s (HTTP %d): %s", model, resp.StatusCode, string(bodyBytes))
				}
			}

			// 2. Generate 3D Stylized Image with Gemini Flash Image / Imagen 3 on Vertex AI
			imagePrompt := fmt.Sprintf("Generate an image: stylized 3D animation render of %s, Blender 3D style, vibrant studio lighting, isolated floating centered on solid pitch black background, balanced composition, no background scenery, 16:9 widescreen", payload.Prompt)

			candidateModels := []string{getGeminiImageModel()}
			if !contains(candidateModels, "gemini-2.5-flash-image") {
				candidateModels = append(candidateModels, "gemini-2.5-flash-image")
			}

			client := &http.Client{Timeout: 25 * time.Second}

			for _, candidateModel := range candidateModels {
				if imageData != "" {
					break
				}
				var imageUrl string
				if strings.HasPrefix(candidateModel, "gemini-3") || strings.HasPrefix(candidateModel, "gemini-2.5") || location == "global" {
					imageUrl = fmt.Sprintf("https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/google/models/%s:generateContent", projectID, candidateModel)
				} else {
					imageUrl = fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent", location, projectID, location, candidateModel)
				}

				imageReqPayload := map[string]interface{}{
					"contents": []map[string]interface{}{
						{
							"role": "user",
							"parts": []map[string]interface{}{
								{"text": imagePrompt},
							},
						},
					},
				}

				bytesReq, err := json.Marshal(imageReqPayload)
				if err != nil {
					continue
				}

				req, err := http.NewRequestWithContext(ctx, "POST", imageUrl, bytes.NewBuffer(bytesReq))
				if err != nil {
					continue
				}
				req.Header.Set("Authorization", "Bearer "+token)
				req.Header.Set("Content-Type", "application/json")

				resp, err := client.Do(req)
				if err != nil {
					log.Printf("[creative] Vertex AI request error for model %s: %v", candidateModel, err)
					continue
				}

				bodyBytes, _ := io.ReadAll(resp.Body)
				resp.Body.Close()

				if resp.StatusCode != http.StatusOK {
					log.Printf("[creative] Vertex AI image generation error for model %s (HTTP %d): %s", candidateModel, resp.StatusCode, string(bodyBytes))
					continue
				}

				var imageResp struct {
					Candidates []struct {
						Content struct {
							Parts []struct {
								Text       string `json:"text"`
								InlineData *struct {
									MimeType string `json:"mimeType"`
									Data     string `json:"data"`
								} `json:"inlineData"`
							} `json:"parts"`
						} `json:"content"`
					} `json:"candidates"`
				}

				if err := json.Unmarshal(bodyBytes, &imageResp); err == nil && len(imageResp.Candidates) > 0 {
					for _, part := range imageResp.Candidates[0].Content.Parts {
						if part.InlineData != nil && part.InlineData.Data != "" {
							imageData = fmt.Sprintf("data:%s;base64,%s", part.InlineData.MimeType, part.InlineData.Data)
							log.Printf("[creative] Successfully generated creative image with Vertex AI model %s", candidateModel)
							break
						}
					}
				}
			}

			// If Gemini Flash Image models did not return image data, attempt Imagen 3 via :predict
			if imageData == "" {
				imagenUrl := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/imagen-3.0-generate-002:predict", location, projectID, location)
				imagenPayload := map[string]interface{}{
					"instances": []map[string]interface{}{
						{"prompt": imagePrompt},
					},
					"parameters": map[string]interface{}{
						"sampleCount": 1,
						"aspectRatio": "16:9",
					},
				}
				if bReq, err := json.Marshal(imagenPayload); err == nil {
					if req, err := http.NewRequestWithContext(ctx, "POST", imagenUrl, bytes.NewBuffer(bReq)); err == nil {
						req.Header.Set("Authorization", "Bearer "+token)
						req.Header.Set("Content-Type", "application/json")
						if resp, err := client.Do(req); err == nil {
							bodyBytes, _ := io.ReadAll(resp.Body)
							resp.Body.Close()
							if resp.StatusCode == http.StatusOK {
								var imagenResp struct {
									Predictions []struct {
										BytesBase64Encoded string `json:"bytesBase64Encoded"`
										MimeType           string `json:"mimeType"`
									} `json:"predictions"`
								}
								if err := json.Unmarshal(bodyBytes, &imagenResp); err == nil && len(imagenResp.Predictions) > 0 {
									p := imagenResp.Predictions[0]
									if p.BytesBase64Encoded != "" {
										mime := p.MimeType
										if mime == "" {
											mime = "image/png"
										}
										imageData = fmt.Sprintf("data:%s;base64,%s", mime, p.BytesBase64Encoded)
										log.Printf("[creative] Successfully generated creative image with Vertex AI Imagen 3")
									}
								}
							} else {
								log.Printf("[creative] Vertex AI Imagen 3 request error (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
							}
						}
					}
				}
			}
		} else {
			log.Printf("[creative] Vertex AI token resolution failed: %v", err)
		}
	} else {
		log.Printf("[creative] Vertex AI credentials lookup failed: %v", err)
	}

	// Fallback safety net: if no image data was produced by Vertex AI (e.g. quota, permissions, or model unavailable on GCP project),
	// load the matching high-fidelity 3D studio product render so the user sees a real, stunning ad image.
	if imageData == "" {
		log.Printf("[creative] Loading high-fidelity 3D product creative fallback for prompt '%s' -> '%s' (%s)", payload.Prompt, title, category)
		imageData = getFallbackCreativeImage(payload.Prompt, title, category)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"title":      title,
		"banner":     banner,
		"category":   category,
		"image_data": imageData,
	})
}

func contains(slice []string, val string) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}

func getFallbackCreativeImage(prompt, title, category string) string {
	filename := matchCreativeImageFilename(prompt, title, category)

	candidates := []string{
		filepath.Join("creatives", filename),
		filepath.Join("../ad_ops_control_center/public/images/creatives", filename),
		filepath.Join("../ad_ops_control_center/dist/images/creatives", filename),
		filepath.Join("ad_ops_control_center/public/images/creatives", filename),
		filepath.Join("/app/dist/images/creatives", filename),
	}

	for _, p := range candidates {
		if b, err := os.ReadFile(p); err == nil && len(b) > 0 {
			log.Printf("[creative] Loaded 3D product creative fallback from %s (%d bytes)", p, len(b))
			return fmt.Sprintf("data:image/jpeg;base64,%s", base64.StdEncoding.EncodeToString(b))
		}
	}

	return "/images/creatives/" + filename
}

func matchCreativeImageFilename(prompt, title, category string) string {
	combined := strings.ToLower(prompt + " " + title + " " + category)

	if strings.Contains(combined, "processor") || strings.Contains(combined, "blend") || strings.Contains(combined, "food") || strings.Contains(combined, "kitchen") || strings.Contains(combined, "cook") || strings.Contains(combined, "smoothie") {
		return "food_processor.jpg"
	}
	if strings.Contains(combined, "shoe") || strings.Contains(combined, "sneaker") || strings.Contains(combined, "runner") || strings.Contains(combined, "footwear") || strings.Contains(combined, "kicks") || strings.Contains(combined, "run") {
		return "sneaker.jpg"
	}
	if strings.Contains(combined, "watch") || strings.Contains(combined, "smartwatch") || strings.Contains(combined, "wrist") || strings.Contains(combined, "wearable") || strings.Contains(combined, "clock") {
		return "smartwatch.jpg"
	}
	if strings.Contains(combined, "headset") || strings.Contains(combined, "headphone") || strings.Contains(combined, "audio") || strings.Contains(combined, "sound") || strings.Contains(combined, "music") || strings.Contains(combined, "ear") {
		return "headset.jpg"
	}
	if strings.Contains(combined, "keyboard") || strings.Contains(combined, "keycap") || strings.Contains(combined, "typing") || strings.Contains(combined, "switch") || strings.Contains(combined, "mechanical") {
		return "keyboard.jpg"
	}
	if strings.Contains(combined, "coffee") || strings.Contains(combined, "espresso") || strings.Contains(combined, "brew") || strings.Contains(combined, "roast") || strings.Contains(combined, "latte") || strings.Contains(combined, "cafe") {
		return "coffee.jpg"
	}
	if strings.Contains(combined, "energy") || strings.Contains(combined, "drink") || strings.Contains(combined, "beverage") || strings.Contains(combined, "can") || strings.Contains(combined, "soda") || strings.Contains(combined, "volt") {
		return "energy_drink.jpg"
	}
	if strings.Contains(combined, "glass") || strings.Contains(combined, "sunglass") || strings.Contains(combined, "eyewear") || strings.Contains(combined, "shade") || strings.Contains(combined, "vision") {
		return "sunglasses.jpg"
	}
	if strings.Contains(combined, "backpack") || strings.Contains(combined, "pack") || strings.Contains(combined, "bag") || strings.Contains(combined, "rucksack") {
		return "backpack.jpg"
	}
	if strings.Contains(combined, "jacket") || strings.Contains(combined, "coat") || strings.Contains(combined, "apparel") || strings.Contains(combined, "hoodie") || strings.Contains(combined, "cloth") {
		return "jacket.jpg"
	}
	if strings.Contains(combined, "sunscreen") || strings.Contains(combined, "skin") || strings.Contains(combined, "lotion") || strings.Contains(combined, "cream") || strings.Contains(combined, "beauty") || strings.Contains(combined, "spf") {
		return "sunscreen.jpg"
	}
	if strings.Contains(combined, "bike") || strings.Contains(combined, "cycling") || strings.Contains(combined, "handlebar") {
		return "handlebar_bag.jpg"
	}

	switch category {
	case "gaming":
		return "headset.jpg"
	case "fashion":
		return "sneaker.jpg"
	default:
		return "smartwatch.jpg"
	}
}
