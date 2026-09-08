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
	if projectID == "" || projectID == "(unset)" {
		projectID = os.Getenv("GCP_PROJECT_ID")
	}
	if projectID == "" || projectID == "(unset)" {
		projectID = os.Getenv("DEVSHELL_PROJECT_ID")
	}
	if projectID == "" || projectID == "(unset)" {
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
		if strings.Contains(pLower, "shoe") || strings.Contains(pLower, "sneaker") || strings.Contains(pLower, "kicks") || strings.Contains(pLower, "run") {
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
		if creds.ProjectID != "" && (projectID == "" || projectID == "vibeflix-sandbox" || projectID == "(unset)") {
			projectID = creds.ProjectID
		}
		tokenSource := creds.TokenSource
		tok, err := tokenSource.Token()
		if err == nil && tok.AccessToken != "" {
			token := tok.AccessToken

			// 1. Generate Title, Tagline, & Category with Gemini on Vertex AI
			model := getGeminiModel()
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

			if bytesReq, err := json.Marshal(geminiReqPayload); err == nil {
				req, err := http.NewRequestWithContext(ctx, "POST", geminiUrl, bytes.NewBuffer(bytesReq))
				if err == nil {
					req.Header.Set("Authorization", "Bearer "+token)
					req.Header.Set("Content-Type", "application/json")
					client := &http.Client{Timeout: 15 * time.Second}
					if resp, err := client.Do(req); err == nil {
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
								}
							}
						} else {
							log.Printf("[creative] Vertex AI text generation error (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
						}
					}
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
				imagenRegion := location
				if imagenRegion == "global" || imagenRegion == "" {
					imagenRegion = "us-central1"
				}
				imagenModels := []string{"imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"}
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
					for _, imgModel := range imagenModels {
						if imageData != "" {
							break
						}
						imagenUrl := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:predict", imagenRegion, projectID, imagenRegion, imgModel)
						req, err := http.NewRequestWithContext(ctx, "POST", imagenUrl, bytes.NewBuffer(bReq))
						if err != nil {
							continue
						}
						req.Header.Set("Authorization", "Bearer "+token)
						req.Header.Set("Content-Type", "application/json")
						resp, err := client.Do(req)
						if err != nil {
							log.Printf("[creative] Vertex AI Imagen request error for %s: %v", imgModel, err)
							continue
						}
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
									log.Printf("[creative] Successfully generated creative image with Vertex AI model %s", imgModel)
									break
								}
							}
						} else {
							log.Printf("[creative] Vertex AI Imagen request error for %s (HTTP %d): %s", imgModel, resp.StatusCode, string(bodyBytes))
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

	// Fallback safety net: if no image data was produced (e.g. quota, permissions, or model unavailable on GCP project),
	// dynamically generate a high-fidelity 16:9 SVG ad creative data URI so the student is NEVER blocked.
	if imageData == "" {
		log.Printf("[creative] Generating dynamic SVG creative banner fallback for '%s' (%s)", title, category)
		imageData = generateFallbackCreativeImage(title, banner, category)
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

func generateFallbackCreativeImage(title, banner, category string) string {
	accentColor := "#06b6d4" // tech cyan
	badgeText := "HIGH-PERFORMANCE HARDWARE"
	iconSvg := `<polygon points="640,230 700,265 700,335 640,370 580,335 580,265" fill="none" stroke="#06b6d4" stroke-width="4"/><circle cx="640" cy="300" r="28" fill="#06b6d4" opacity="0.8"/>`

	switch strings.ToLower(category) {
	case "gaming":
		accentColor = "#a855f7" // purple
		badgeText = "NEXT-GEN GAMING RIG"
		iconSvg = `<rect x="580" y="260" width="120" height="80" rx="20" fill="none" stroke="#a855f7" stroke-width="4"/><circle cx="610" cy="300" r="10" fill="#a855f7"/><rect x="655" y="295" width="25" height="10" rx="2" fill="#a855f7"/><rect x="662" y="287" width="10" height="25" rx="2" fill="#a855f7"/>`
	case "fashion":
		accentColor = "#10b981" // emerald
		badgeText = "PREMIUM ATHLETIC APPAREL"
		iconSvg = `<polygon points="640,230 685,300 640,370 595,300" fill="none" stroke="#10b981" stroke-width="4"/><circle cx="640" cy="300" r="20" fill="#10b981" opacity="0.8"/>`
	}

	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
  <defs>
    <linearGradient id="bgGrad" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#050814"/>
      <stop offset="50%%" stop-color="#0b1329"/>
      <stop offset="100%%" stop-color="#02040a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%%" cy="45%%" r="45%%">
      <stop offset="0%%" stop-color="%s" stop-opacity="0.32"/>
      <stop offset="100%%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pillGrad" x1="0%%" y1="0%%" x2="100%%" y2="0%%">
      <stop offset="0%%" stop-color="%s" stop-opacity="0.25"/>
      <stop offset="100%%" stop-color="%s" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bgGrad)"/>
  <rect width="1280" height="720" fill="url(#glow)"/>
  
  <!-- Subtle Grid Lines -->
  <line x1="140" y1="180" x2="1140" y2="180" stroke="#ffffff" stroke-opacity="0.05" stroke-dasharray="4,8"/>
  <line x1="140" y1="540" x2="1140" y2="540" stroke="#ffffff" stroke-opacity="0.05" stroke-dasharray="4,8"/>

  <!-- Top Badges -->
  <rect x="140" y="80" width="200" height="32" rx="16" fill="url(#pillGrad)" stroke="%s" stroke-opacity="0.4"/>
  <circle cx="156" cy="96" r="4" fill="%s"/>
  <text x="170" y="101" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="%s" letter-spacing="1.5">VIBETUBE 4K HDR</text>

  <rect x="980" y="80" width="160" height="32" rx="16" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.15"/>
  <text x="1060" y="101" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#94a3b8" letter-spacing="1">PRE-ROLL • 10S</text>

  <!-- Central Visual Glyph -->
  %s

  <!-- Category Sub-badge -->
  <text x="640" y="425" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="%s" letter-spacing="3">%s</text>

  <!-- Main Headline Title -->
  <text x="640" y="485" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="-0.5">%s</text>

  <!-- Tagline / Banner -->
  <text x="640" y="530" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="400" fill="#cbd5e1">%s</text>

  <!-- Bottom Watermark -->
  <text x="640" y="640" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b" letter-spacing="2">POWERED BY GOOGLE CLOUD VERTEX AI</text>
</svg>`, accentColor, accentColor, accentColor, accentColor, accentColor, accentColor, iconSvg, accentColor, badgeText, title, banner)

	return fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString([]byte(svg)))
}
