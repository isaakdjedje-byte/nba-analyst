/**
 * Swagger UI Documentation Endpoint
 * 
 * Serves interactive API documentation using Swagger UI.
 * GET /api/v1/b2b/docs
 * 
 * Story 6.4: Implementer la documentation API OpenAPI et exemples
 */

import { NextResponse } from 'next/server';

/**
 * GET /api/v1/b2b/docs
 * 
 * Returns an HTML page with Swagger UI for interactive API exploration.
 * No authentication required - this is public documentation.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NBA Analyst B2B API - Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .topbar {
      display: none;
    }
    .swagger-ui .info {
      margin: 30px 0;
    }
    .swagger-ui .info .title {
      font-size: 2.5em;
      font-weight: 700;
    }
    .swagger-ui .info .description {
      font-size: 1.1em;
      line-height: 1.6;
    }
    .api-logo {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/v1/b2b/openapi',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout',
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        oauth2RedirectUrl: window.location.origin + '/api/v1/b2b/docs/oauth2-redirect',
        initOAuth: {
          clientId: 'b2b-api-docs',
          scopes: ['read'],
        },
        requestInterceptor: function(req) {
          // Add API key from prompt or localStorage
          const apiKey = localStorage.getItem('b2b-api-key') || prompt('Enter your API key (or leave empty for demo):');
          if (apiKey) {
            req.headers['X-API-Key'] = apiKey;
            localStorage.setItem('b2b-api-key', apiKey);
          }
          return req;
        },
      });
      
      window.ui = ui;
    };
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
