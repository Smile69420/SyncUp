# SyncUp Google Apps Script Backend

This script acts as a secure, server-side backend to handle integrations with Google Calendar (for creating Meet links) and Google Sheets.

## Deployment Instructions

Follow these steps carefully to deploy the script and connect it to your SyncUp application.

### Step 1: Create the Apps Script Project

1.  Go to the Google Apps Script dashboard: [script.google.com](https://script.google.com).
2.  Click on **New project**.
3.  Give the project a name, for example, "SyncUp Backend".

### Step 2: Add the Script Code

1.  Delete any existing code in the `Code.gs` file.
2.  Copy the entire content of the `main.gs` file from this directory and paste it into the Apps Script editor.
3.  Save the project (File > Save project, or `Ctrl+S`).

### Step 3: Configure the Manifest File

1.  In the Apps Script editor, go to **Project Settings** (the gear icon on the left).
2.  Check the box that says **"Show "appsscript.json" manifest file in editor"**.
3.  Return to the **Editor** (the `<>` icon). You will now see an `appsscript.json` file in the file list.
4.  Click on `appsscript.json`.
5.  Delete its current content and replace it with the content from the `appsscript.json` file in this directory. This step is crucial for granting the correct permissions.
6.  Save the project again.

### Step 4: Deploy as a Web App

1.  Click the **Deploy** button in the top right corner and select **New deployment**.
2.  Click the gear icon next to "Select type" and choose **Web app**.
3.  Configure the deployment:
    *   **Description:** `Initial deployment for SyncUp App`
    *   **Execute as:** `Me (your-email@gmail.com)` (This is very important for security)
    *   **Who has access:** `Anyone` (This allows your web app to call the script. The execution is still secured to your account).
4.  Click **Deploy**.

### Step 5: Authorize Permissions

1.  Google will prompt you to authorize the script's permissions. This is a one-time step.
2.  Click **Authorize access**.
3.  Choose your Google account.
4.  You may see a "Google hasn’t verified this app" warning. This is normal for your own scripts. Click **Advanced**, and then click **"Go to (Your Project Name) (unsafe)"**.
5.  Review the permissions (Calendar, Sheets) and click **Allow**.

### Step 6: Get the Web App URL

1.  After deployment, a "Deployment updated" dialog will appear.
2.  **Copy the Web app URL**. It will look something like `https://script.google.com/macros/s/.../exec`.
3.  Click **Done**.

### Step 7: Configure Your Frontend

1.  Take the Web app URL you just copied.
2.  Add it to your project's environment variables (e.g., in a `.env.local` file for local development or in your Vercel project settings). The variable name must be `VITE_APPS_SCRIPT_URL`.

    ```
    VITE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
    ```

### Step 8: Set Up Automated Reminders (New)

To enable automated email reminders for upcoming meetings, you need to create a time-driven trigger.

1.  In the Apps Script editor, click on the **Triggers** icon (a clock) on the left sidebar.
2.  Click the **+ Add Trigger** button in the bottom right.
3.  Configure the trigger with the following settings:
    *   **Choose which function to run:** `checkAndSendReminders`
    *   **Choose which deployment should run:** `Head`
    *   **Select event source:** `Time-driven`
    *   **Select type of time based trigger:** `Minutes timer`
    *   **Select minute interval:** `Every 15 minutes` (or `Every 30 minutes`)
4.  Click **Save**.

You will be asked to authorize the script again because the triggers require background execution permissions. This is normal. After saving, the script will automatically check for upcoming meetings every 15 minutes and send reminders.


**Important:** If you ever make changes to the script code in `main.gs`, you must create a **new deployment** to make those changes live. Go to **Deploy > Manage deployments**, select your deployment, click the pencil icon to edit, and change the version to **"New version"**.
