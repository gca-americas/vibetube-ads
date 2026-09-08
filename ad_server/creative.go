package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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
	return "gemini-2.5-flash-image"
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

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	// Authenticate to Vertex AI using Google Application Default Credentials (ADC)
	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err == nil && creds != nil {
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
							if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err == nil && len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
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
						}
						resp.Body.Close()
					}
				}
			}

			// 2. Generate 3D Stylized Image with Gemini Flash Image on Vertex AI
			imageUrl := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent", location, projectID, location, getGeminiImageModel())
			imagePrompt := fmt.Sprintf("Generate an image: stylized 3D animation render of %s, Blender 3D style, vibrant studio lighting, isolated floating centered on solid pitch black background, balanced composition, no background scenery, 16:9 widescreen", payload.Prompt)

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

			if bytesReq, err := json.Marshal(imageReqPayload); err == nil {
				req, err := http.NewRequestWithContext(ctx, "POST", imageUrl, bytes.NewBuffer(bytesReq))
				if err == nil {
					req.Header.Set("Authorization", "Bearer "+token)
					req.Header.Set("Content-Type", "application/json")
					client := &http.Client{Timeout: 25 * time.Second}
					if resp, err := client.Do(req); err == nil {
						if resp.StatusCode == http.StatusOK {
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
							if err := json.NewDecoder(resp.Body).Decode(&imageResp); err == nil && len(imageResp.Candidates) > 0 {
								for _, part := range imageResp.Candidates[0].Content.Parts {
									if part.InlineData != nil && part.InlineData.Data != "" {
										imageData = fmt.Sprintf("data:%s;base64,%s", part.InlineData.MimeType, part.InlineData.Data)
										break
									}
								}
							}
						}
						resp.Body.Close()
					}
				}
			}
		}
	}

	creativeUrl := "https://storage.googleapis.com/vibetube-sandbox-public-streams/ads/sample_ad_creative.mp4"

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"title":        title,
		"banner":       banner,
		"category":     category,
		"image_data":   imageData,
		"creative_url": creativeUrl,
	})
}
