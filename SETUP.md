# Setup

One-time setup to get Cloud Kitchen Manager hosted and connected to your own data.

## 1. Create two repositories on GitHub

1. **`cloud-kitchen-app`** — public. This holds the app code (this project).
2. **`cloud-kitchen-data`** — private. This holds nothing but your data; create it empty.

If you name either repo differently, update `base` in `vite.config.ts`, the `icons`/`start_url` in the PWA
manifest, and the repo name you enter in the app's Settings screen, to match.

## 2. Push this code to `cloud-kitchen-app`

    git remote add origin https://github.com/<your-username>/cloud-kitchen-app.git
    git push -u origin main

## 3. Seed the data repo

In `cloud-kitchen-data`, create a file named `data.json` at the repo root with this exact content:

    {
      "menuItems": [],
      "sales": [],
      "inventory": [],
      "stockMoves": [],
      "expenses": [],
      "settings": { "defaultZomatoCommissionPct": 0 }
    }

(The app can also create this file itself on first save if you skip this step — but creating it up front
lets you confirm the repo is set up correctly first.)

## 4. Generate a fine-grained Personal Access Token

1. Go to https://github.com/settings/personal-access-tokens/new
2. Under **Repository access**, choose **Only select repositories** and pick `cloud-kitchen-data` only.
3. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**. Leave everything else as **No access**.
4. Set an expiration you're comfortable with (you'll need to regenerate and re-enter it in Settings when it expires).
5. Generate the token and copy it — GitHub only shows it once.

## 5. Enable GitHub Pages

In `cloud-kitchen-app` → **Settings → Pages**, set **Source** to **GitHub Actions**. The deploy workflow
(`.github/workflows/deploy.yml`) will publish the site automatically on every push to `main`.

## 6. First run

1. Visit `https://<your-username>.github.io/cloud-kitchen-app/`.
2. You'll land on **Settings** (no connection configured yet).
3. Enter the token from step 4, your GitHub username, and `cloud-kitchen-data` as the repo name. Click **Save & Connect**.
4. You should see "Connected to `<your-username>/cloud-kitchen-data`." If you see a connection error instead,
   double check the token's repository access and permissions (step 4).

## What's needed from you, summarized

- A GitHub account.
- The two repos created as described above.
- The fine-grained PAT, scoped only to `cloud-kitchen-data`, pasted into the app once.

Nothing else is required to host this — GitHub Pages and GitHub Actions are both free for public repos.
