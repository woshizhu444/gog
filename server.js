// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const port = process.env.PORT || 3000; // Use port from .env or default to 3000

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('.')); // Serve static files (HTML, CSS, JS) from the current directory

// --- Google Workspace API Setup ---
// --- Google Workspace API Setup ---
let authOptions = {
    scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
    clientOptions: {
        subject: process.env.GOOGLE_ADMIN_EMAIL
    }
};

const credentialsEnvVar = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (credentialsEnvVar && credentialsEnvVar.trim().startsWith('{')) {
    // If the env var looks like a JSON object, parse it and use 'credentials'
    try {
        console.log("Attempting to parse GOOGLE_APPLICATION_CREDENTIALS as JSON content.");
        authOptions.credentials = JSON.parse(credentialsEnvVar);
    } catch (e) {
        console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS as JSON, falling back to keyFile:", e);
        // Fallback to keyFile if JSON parsing fails (though unlikely if it starts with '{')
        authOptions.keyFile = credentialsEnvVar;
    }
} else if (credentialsEnvVar) {
    // Otherwise, assume it's a file path and use 'keyFile'
    console.log("Using GOOGLE_APPLICATION_CREDENTIALS as keyFile path.");
    authOptions.keyFile = credentialsEnvVar;
} else {
    console.error("GOOGLE_APPLICATION_CREDENTIALS environment variable is not set!");
    // Handle error appropriately - maybe exit or throw
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS environment variable is required.");
}

const auth = new google.auth.GoogleAuth(authOptions);
const admin = google.admin({ version: 'directory_v1', auth });
const domain = process.env.GOOGLE_WORKSPACE_DOMAIN; // Domain from .env

// --- API Endpoints ---

// POST /register endpoint
app.post('/register', async (req, res) => {
    console.log('Received registration request:', req.body);
    // 从请求体中获取所有字段，包括新的 username
    const { lastName, firstName, username, password, recoveryEmail } = req.body;

    // Basic validation (should be more robust in production)
    // 更新验证逻辑，包含 username
    // 更新验证逻辑，包含 username 和必填的 recoveryEmail
    if (!lastName || !firstName || !username || !password || !recoveryEmail) {
        return res.status(400).json({ success: false, message: 'Missing required fields (lastName, firstName, username, password, recoveryEmail).' });
    }

    // 可选：添加更严格的服务器端用户名验证（例如，防止注入等）
    const usernameRegex = /^[a-z0-9.-]+$/; // 与前端保持一致
    if (!usernameRegex.test(username)) {
         return res.status(400).json({ success: false, message: 'Invalid username format. Use only lowercase letters, numbers, dots, or hyphens.' });
    }

    try {
        // --- Generate Student ID ---
        // Simple example: 'S' + 6 random digits. Customize as needed.
        const studentId = `S${Math.floor(100000 + Math.random() * 900000)}`;
        console.log(`Generated Student ID: ${studentId}`);

        // --- Generate Username ---
        // Example: firstname.lastname@yourdomain.com. Ensure uniqueness in production.
        // 使用用户提供的 username 构建 primaryEmail
        const primaryEmail = `${username}@${domain}`; // domain 来自 .env
        console.log(`Constructed Primary Email: ${primaryEmail}`);

        // TODO (后续): 在调用 insert 之前，最好先调用 admin.users.get({ userKey: primaryEmail })
        // 来检查用户是否已存在，并返回更友好的错误信息。
        // 这需要 API 调用成功，所以我们暂时跳过。


        // --- Integrate with Google Workspace API ---

        // Define the new user object for the Google API
        const newUser = {
            primaryEmail: primaryEmail,
            name: {
                givenName: firstName,
                familyName: lastName,
            },
            password: password,
            changePasswordAtNextLogin: true, // Force password change on first login
            // Include recovery email if provided by the user
            ...(recoveryEmail && { recoveryEmail: recoveryEmail }),
            // Store student ID using externalIds (type 'organization' is common)
            // Ensure this field is usable/visible in your Workspace settings if needed.
            // Alternatively, set up a custom schema in Google Admin Console
            // and use `customSchemas` field here.
            externalIds: [
                 { type: 'organization', value: studentId } // Using 'organization' type
                 // Example for custom schema (replace YourSchemaName and StudentIDFieldName):
                 // { type: 'custom', customType: 'YourSchemaName', value: studentId }
            ],
            // Example for custom schema:
            // customSchemas: {
            //     "EmployeeDetails": { // Replace with your actual schema name
            //         "employeeId": studentId // Replace with your field name
            //     }
            // }
        };

        console.log("Attempting to create Google Workspace user:", JSON.stringify(newUser, null, 2));

        // Call the Google Admin SDK to insert the user
        const createResponse = await admin.users.insert({
            requestBody: newUser,
        });

        console.log('Google API User Creation Response Status:', createResponse.status);
        // console.log('Google API Response Data:', createResponse.data); // Contains created user details

        // Check if the API call was successful (status code 200-299)
        if (createResponse.status >= 200 && createResponse.status < 300) {
             // Respond to the frontend on success
            res.status(201).json({ // 201 Created status
                success: true,
                message: '注册成功！用户已在 Google Workspace 中创建。',
                username: createResponse.data.primaryEmail, // Use email confirmed by Google
                studentId: studentId
            });
        } else {
             // If Google API returned an error status but didn't throw an exception
             throw new Error(`Google API failed with status: ${createResponse.status}`);
        }


    } catch (error) {
        console.error('Error processing registration:', error);
        // Provide more specific error messages based on the error type
        let errorMessage = '注册过程中发生错误，请稍后重试。';
        // More specific error handling for Google API errors
        if (error.code === 409) { // HTTP 409 Conflict usually means user already exists
            // 确保错误消息使用正确的 primaryEmail
            errorMessage = `用户 ${username}@${domain} 已存在。`;
        } else if (error.code === 403) { // HTTP 403 Forbidden often means permission issues
             errorMessage = '权限不足，无法创建用户。请检查服务账号权限和域范围委派设置。';
        } else if (error.response && error.response.data && error.response.data.error) {
            // Try to get a more specific error message from Google API response
            errorMessage = `Google API 错误: ${error.response.data.error.message || JSON.stringify(error.response.data.error)}`;
        } else if (error.message) {
            errorMessage = `注册失败: ${error.message}`;
        }

        res.status(500).json({ success: false, message: errorMessage });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`服务器正在运行于 http://localhost:${port}`);
});