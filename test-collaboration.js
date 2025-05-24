// test-collaboration.js
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

// Fix: Use PORT correctly and ensure proper URL construction
const API_PORT = process.env.PORT || 5000;
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

console.log(`API Base URL for tests: ${API_BASE_URL}`);

// --- Test Data (ensure these emails are not already registered) ---
const userA = {
  email: `usera_${Date.now()}@test.com`,
  password: "passwordA123",
  name: "Test User A",
};

const userB = {
  email: `userb_${Date.now()}@test.com`,
  password: "passwordB123",
  name: "Test User B",
};

let tokenA = "";
let userIdA = "";
let tokenB = "";
let userIdB = "";
let documentId = "";

// --- Helper Function for API Calls ---
async function apiCall(method, url, data = null, token = "") {
  try {
    const config = {
      method: method,
      url: `${API_BASE_URL}${url}`,
      headers: { "Content-Type": "application/json" },
    };

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);

    console.log(`\n--- ${method.toUpperCase()} ${url} SUCCESS ---`);
    console.log("Status:", response.status);
    console.log("Data:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(`\n--- ${method.toUpperCase()} ${url} FAILED ---`);
    console.error(
      "Error Status:",
      error.response ? error.response.status : "N/A"
    );
    console.error(
      "Error Data:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );
    throw error;
  }
}

// --- Main Test Function ---
async function runCollaborationTests() {
  console.log("Starting Collaboration Test Suite...");

  try {
    // 1. Register User A
    console.log("\n1. Registering User A...");
    await apiCall("post", "/auth/register", userA);

    // 2. Login User A and get token and ID
    console.log("\n2. Logging in User A...");
    const loginAResponse = await apiCall("post", "/auth/login", {
      email: userA.email,
      password: userA.password,
    });
    tokenA = loginAResponse.token;
    userIdA = loginAResponse.data.id;
    console.log("User A Token:", tokenA);
    console.log("User A ID:", userIdA);

    // 3. Register User B
    console.log("\n3. Registering User B...");
    await apiCall("post", "/auth/register", userB);

    // 4. Login User B and get token and ID
    console.log("\n4. Logging in User B...");
    const loginBResponse = await apiCall("post", "/auth/login", {
      email: userB.email,
      password: userB.password,
    });
    tokenB = loginBResponse.token;
    userIdB = loginBResponse.data.id;
    console.log("User B Token:", tokenB);
    console.log("User B ID:", userIdB);

    // 5. User A creates a document
    console.log("\n5. User A creating a document...");
    const createDocResponse = await apiCall(
      "post",
      "/documents",
      { title: "Collaboration Test Doc", content: "Initial content." },
      tokenA
    );
    documentId = createDocResponse.data.id;
    if (!documentId) {
      throw new Error("Could not extract document ID from creation response.");
    }
    console.log("Created Document ID:", documentId);

    // 6. User A adds User B as an EDITOR to the document
    console.log(
      `\n6. User A adding User B (${userB.email}) as EDITOR to document ${documentId}...`
    );
    await apiCall(
      "post",
      `/documents/${documentId}/collaborators`,
      { email: userB.email, role: "EDITOR" },
      tokenA
    );

    // 7. User B tries to view the document
    console.log(`\n7. User B attempting to view document ${documentId}...`);
    await apiCall("get", `/documents/${documentId}`, null, tokenB);

    // 8. User B tries to update the document (should succeed as EDITOR)
    console.log(
      `\n8. User B attempting to update document ${documentId} (should succeed as EDITOR)...`
    );
    await apiCall(
      "put",
      `/documents/${documentId}`,
      { content: "Updated content by User B." },
      tokenB
    );

    // 9. User B tries to delete the document (should fail as EDITOR, only OWNER can delete)
    console.log(
      `\n9. User B attempting to delete document ${documentId} (should FAIL as EDITOR)...`
    );
    try {
      await apiCall("delete", `/documents/${documentId}`, null, tokenB);
      console.error(
        "ERROR: User B was able to delete the document, but should not have."
      );
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log(
          "SUCCESS: User B correctly denied deletion (403 Forbidden)."
        );
      } else {
        console.error(
          "ERROR: User B deletion failed for unexpected reason:",
          error.response ? error.response.status : error.message
        );
        throw error;
      }
    }

    // 10. User A retrieves collaborators for the document
    console.log(
      `\n10. User A retrieving collaborators for document ${documentId}...`
    );
    const collaboratorsResponse = await apiCall(
      "get",
      `/documents/${documentId}/collaborators`,
      null,
      tokenA
    );
    const userBInCollaborators = collaboratorsResponse.collaborators.find(
      (col) => col.user.id === userIdB
    );
    if (userBInCollaborators) {
      console.log(
        "SUCCESS: User B found in collaborators list with role:",
        userBInCollaborators.role
      );
    } else {
      console.error("ERROR: User B not found in collaborators list.");
      throw new Error("User B not found in collaborators list after adding.");
    }

    // 11. User A removes User B as a collaborator
    console.log(
      `\n11. User A removing User B (${userIdB}) from document ${documentId} collaborators...`
    );
    await apiCall(
      "delete",
      `/documents/${documentId}/collaborators/${userIdB}`,
      null,
      tokenA
    );

    // 12. User B tries to view the document again (should fail)
    console.log(
      `\n12. User B attempting to view document ${documentId} again (should FAIL after removal)...`
    );
    try {
      await apiCall("get", `/documents/${documentId}`, null, tokenB);
      console.error(
        "ERROR: User B was still able to view the document after being removed."
      );
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log(
          "SUCCESS: User B correctly denied viewing after removal (403 Forbidden)."
        );
      } else {
        console.error(
          "ERROR: User B viewing failed for unexpected reason:",
          error.response ? error.response.status : error.message
        );
        throw error;
      }
    }

    // 13. User A deletes the document
    console.log(`\n13. User A deleting document ${documentId}...`);
    await apiCall("delete", `/documents/${documentId}`, null, tokenA);
    console.log("Document successfully deleted.");

    console.log("\n✅ Collaboration Test Suite Completed Successfully!");
  } catch (error) {
    console.error("\n❌ Collaboration Test Suite FAILED at a critical step.");
    console.error("Error details:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    process.exit(1); // Exit with error code
  }
}

// Run the tests
runCollaborationTests().catch((error) => {
  console.error("Unhandled error in test suite:", error);
  process.exit(1);
});
