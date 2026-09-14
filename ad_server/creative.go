package main

import (
	"bytes"
	"context"
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

	title := ""
	banner := ""
	category := "tech"
	imageData := ""

	if payload.Prompt != "" {
		words := strings.Fields(payload.Prompt)
		if len(words) > 0 {
			title = strings.Title(strings.Join(words[:min(3, len(words))], " "))
		}
		banner = payload.Prompt
	}

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	// Authenticate to Google Enterprise Agent Platform using Google Application Default Credentials (ADC)
	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil || creds == nil {
		log.Printf("[creative] Google Enterprise Agent Platform credentials lookup failed: %v", err)
		http.Error(w, fmt.Sprintf("Google Cloud credentials lookup failed: %v", err), http.StatusUnauthorized)
		return
	}

	if creds.ProjectID != "" && (projectID == "" || projectID == "vibeflix-sandbox" || projectID == "(unset)") {
		projectID = creds.ProjectID
	}

	tokenSource := creds.TokenSource
	var token string
	for attempt := 0; attempt < 3; attempt++ {
		tok, err := tokenSource.Token()
		if err == nil && tok != nil && tok.AccessToken != "" {
			token = tok.AccessToken
			break
		}
		log.Printf("[creative] Google Enterprise Agent Platform token resolution attempt %d failed: %v", attempt+1, err)
		time.Sleep(1 * time.Second)
	}

	if token == "" {
		log.Printf("[creative] Failed to resolve Google Cloud access token")
		http.Error(w, "Failed to resolve Google Cloud access token (Post \"https://oauth2.googleapis.com/token\" timed out or failed). Please check your connection and try again.", http.StatusBadGateway)
		return
	}

	// 1. Generate Title, Tagline, & Category with Gemini on Google Enterprise Agent Platform
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
							log.Printf("[creative] Google Enterprise Agent Platform text generation error (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
						}
					}
				}
			}

			// 2. Generate 3D Stylized Image with Gemini Flash Image / Imagen 3 on Google Enterprise Agent Platform
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
					log.Printf("[creative] Google Enterprise Agent Platform request error for model %s: %v", candidateModel, err)
					continue
				}

				bodyBytes, _ := io.ReadAll(resp.Body)
				resp.Body.Close()

				if resp.StatusCode != http.StatusOK {
					log.Printf("[creative] Google Enterprise Agent Platform image generation error for model %s (HTTP %d): %s", candidateModel, resp.StatusCode, string(bodyBytes))
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
							log.Printf("[creative] Successfully generated creative image with Google Enterprise Agent Platform model %s", candidateModel)
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
							log.Printf("[creative] Google Enterprise Agent Platform Imagen request error for %s: %v", imgModel, err)
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
									log.Printf("[creative] Successfully generated creative image with Google Enterprise Agent Platform model %s", imgModel)
									break
								}
							}
						} else {
							log.Printf("[creative] Google Enterprise Agent Platform Imagen request error for %s (HTTP %d): %s", imgModel, resp.StatusCode, string(bodyBytes))
						}
					}
		}
	}

	if imageData == "" {
		log.Printf("[creative] Creative image generation failed for prompt: %q", payload.Prompt)
		http.Error(w, "Failed to generate creative image with Google Enterprise Agent Platform (no image data returned). Please try again.", http.StatusBadGateway)
		return
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
