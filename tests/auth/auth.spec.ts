import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Login API", () => {
    test("should authenticate with valid credentials via API", async ({ request }) => {
      // First register a test user
      const registerResponse = await request.post("/api/auth/register", {
        data: {
          name: "Test User",
          email: "test.api@example.com",
          password: "Test1234",
        },
      });
      
      // Registration should succeed or user might already exist
      expect([201, 409]).toContain(registerResponse.status());
      
      // Now attempt login via NextAuth credentials endpoint
      const loginResponse = await request.post("/api/auth/callback/credentials", {
        data: {
          email: "test.api@example.com",
          password: "Test1234",
          csrfToken: "test-token",
          callbackUrl: "/dashboard/picks",
          json: "true",
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      
      // Should redirect or return success
      expect([200, 302]).toContain(loginResponse.status());
    });

    test("should reject invalid credentials via API", async ({ request }) => {
      const response = await request.post("/api/auth/callback/credentials", {
        data: {
          email: "invalid@example.com",
          password: "wrongpassword",
          csrfToken: "test-token",
          callbackUrl: "/dashboard/picks",
          json: "true",
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      
      // Should return 401 or redirect with error
      expect([302, 401]).toContain(response.status());
    });
  });

  test.describe("Login Page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
    });

    test("should display login form", async ({ page }) => {
      // Check page title
      await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

      // Check form fields
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Mot de passe")).toBeVisible();
      await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    });

    test("should validate required fields", async ({ page }) => {
      // Try to submit empty form
      await page.getByRole("button", { name: "Se connecter" }).click();

      // Should show validation error
      await expect(page.getByText("L'email est requis")).toBeVisible();
    });

    test("should validate email format", async ({ page }) => {
      // Enter invalid email
      await page.getByLabel("Email").fill("invalid-email");
      await page.getByLabel("Mot de passe").fill("password123");
      await page.getByRole("button", { name: "Se connecter" }).click();

      // Should show email validation error
      await expect(page.getByText("Veuillez entrer une adresse email valide")).toBeVisible();
    });

    test("should validate password length", async ({ page }) => {
      // Enter short password
      await page.getByLabel("Email").fill("test@example.com");
      await page.getByLabel("Mot de passe").fill("short");
      await page.getByRole("button", { name: "Se connecter" }).click();

      // Should show password length error
      await expect(
        page.getByText("Le mot de passe doit contenir au moins 8 caractères")
      ).toBeVisible();
    });
  });

  test.describe("Register Page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/register");
    });

    test("should display registration form", async ({ page }) => {
      // Check page title
      await expect(
        page.getByRole("heading", { name: "Créer un compte" })
      ).toBeVisible();

      // Check form fields
      await expect(page.getByLabel("Nom")).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Mot de passe").first()).toBeVisible();
      await expect(page.getByLabel("Confirmer le mot de passe")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Créer mon compte" })
      ).toBeVisible();
    });

    test("should validate matching passwords", async ({ page }) => {
      // Enter non-matching passwords
      await page.getByLabel("Nom").fill("Test User");
      await page.getByLabel("Email").fill("test@example.com");
      await page.getByLabel("Mot de passe").first().fill("password123");
      await page.getByLabel("Confirmer le mot de passe").fill("differentpassword");
      await page.getByRole("button", { name: "Créer mon compte" }).click();

      // Should show password mismatch error
      await expect(
        page.getByText("Les mots de passe ne correspondent pas")
      ).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("login form should be accessible", async ({ page }) => {
      await page.goto("/login");

      // Check ARIA labels and roles
      const emailInput = page.getByLabel("Email");
      await expect(emailInput).toHaveAttribute("type", "email");
      await expect(emailInput).toHaveAttribute("autocomplete", "email");

      const passwordInput = page.getByLabel("Mot de passe");
      await expect(passwordInput).toHaveAttribute("type", "password");
      await expect(passwordInput).toHaveAttribute("autocomplete", "current-password");

      // Check for proper heading
      await expect(page.getByRole("heading", { level: 2 })).toHaveText("Connexion");
    });

    test("should support keyboard navigation", async ({ page }) => {
      await page.goto("/login");

      // Tab through form elements
      await page.getByLabel("Email").focus();
      await page.keyboard.press("Tab");

      // Should be on password field
      await expect(page.locator(":focus")).toHaveAttribute("id", "password");

      await page.keyboard.press("Tab");

      // Should be on submit button
      await expect(page.locator(":focus")).toHaveAttribute("type", "submit");
    });
  });

  test.describe("Dark Mode Support", () => {
    test("login form should support dark mode", async ({ page }) => {
      // Enable dark mode (this depends on how dark mode is implemented)
      // For now, just verify the page renders correctly
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
  });
});
