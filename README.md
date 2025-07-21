# Google Drive CLI Uploader

A Node.js script to upload files to Google Drive, share them, and get the shareable link.

## Setup Instructions

1.  **Clone the Repository:**
    `git clone https://github.com/pguardiario/gdrive-upload.git`
    `cd your-repo-name`

2.  **Install Dependencies:**
    `npm install`

3.  **Get Google Credentials:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
    *   Enable the **Google Drive API**.
    *   Go to **Credentials**, click **+ CREATE CREDENTIALS** -> **OAuth client ID**.
    *   Choose **Web application** as the application type.
    *   Under "Authorized redirect URIs", add `http://localhost:5135/oauth2callback`.
    *   Click **CREATE** and then **DOWNLOAD JSON**.

4.  **Add Credentials to Project:**
    *   Rename the downloaded file to `credentials.json`.
    *   Place this `credentials.json` file in the root of the project directory.

5.  **Run the Script:**
    *   The first time you run the script, it will open a browser window for you to authenticate with your Google account.
    *   `node upload.js /path/to/your/file.txt`