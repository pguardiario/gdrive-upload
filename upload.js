const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const cliProgress = require('cli-progress');

const REDIRECT_PORT = 5135;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file']; // This scope is sufficient for creating files and permissions
const TOKEN_PATH = path.join(__dirname, 'token.json');

async function loadSavedCredentialsIfExist() {
  try {
    const content = fs.readFileSync(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = fs.readFileSync(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web || keys;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  fs.writeFileSync(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id } = credentials//.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  const open = (await import('open')).default;

  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    open(authUrl);

    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf('/oauth2callback') > -1) {
          const qs = new url.URL(req.url, `http://localhost:${REDIRECT_PORT}`).searchParams;
          res.end('Authentication successful! Please return to the console.');
          server.close();
          const { tokens } = await oAuth2Client.getToken(qs.get('code'));
          oAuth2Client.setCredentials(tokens);
          await saveCredentials(oAuth2Client);
          resolve(oAuth2Client);
        }
      } catch (e) {
        reject(e);
      }
    }).listen(REDIRECT_PORT, () => {
      console.log(`\nServer listening on port ${REDIRECT_PORT} for authentication callback...`);
    });
  });
}

/**
 * --- UPDATED: This function now uploads, shares, and displays the URL ---
 * Uploads a file, creates a public permission, and logs the shareable link.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 * @param {string} filePath The path of the file to upload.
 */
async function uploadFile(authClient, filePath) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileSize = fs.statSync(filePath).size;
  const fileName = path.basename(filePath);

  const progressBar = new cliProgress.SingleBar({
    format: `Uploading ${fileName} | {bar} | {percentage}% || {value}/{total} Bytes`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  progressBar.start(fileSize, 0);

  const res = await drive.files.create(
    {
      requestBody: {
        name: fileName,
        mimeType: 'application/octet-stream',
      },
      media: {
        body: fs.createReadStream(filePath),
      },
      // --- NEW: Request the webViewLink along with the id ---
      fields: 'id, webViewLink',
    },
    {
      onUploadProgress: (evt) => {
        progressBar.update(evt.bytesRead);
      },
    }
  );

  progressBar.stop();
  console.log(`\nFile uploaded successfully.`);

  const fileId = res.data.id;
  const shareUrl = res.data.webViewLink;

  // --- NEW: Section to create the public permission ---
  console.log('Sharing file...');
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });
  // --- End of new sharing section ---

  console.log('File shared successfully!');
  console.log(`- ID: ${fileId}`);
  console.log(`- Share URL: ${shareUrl}`);
}

/**
 * The main function that drives the script.
 */
async function main() {
    let filePaths = process.argv.slice(2);
    if (filePaths.length === 0) {
      console.log('Please provide one or more file paths to upload.');
      process.exit(1);
      // filePaths = ["ss.png"]
    }

    try {
        const authClient = await authorize();
        for (const filePath of filePaths) {
          if (fs.existsSync(filePath)) {
            await uploadFile(authClient, filePath);
            console.log('---'); // Add a separator for clarity between files
          } else {
            console.warn(`\nWarning: File not found at '${filePath}'. Skipping.`);
          }
        }
        process.exit(0);
    } catch (error) {
        if(error.message === 'invalid_grant') {
          console.log('\nStale or invalid credentials. Deleting token and attempting to re-authorize...');
          if (fs.existsSync(TOKEN_PATH)) {
            fs.unlinkSync(TOKEN_PATH);
          }
          return main();
        } else {
          console.error('\nAn error occurred:', error.message);
          process.exit(1);
        }

    }
}

main();
