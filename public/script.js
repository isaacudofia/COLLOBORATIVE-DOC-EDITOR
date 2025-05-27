const API_BASE_URL = "http://localhost:5000/api"; // Adjust if your backend port is different
const socket = io("http://localhost:5000"); // Connect to your Socket.IO server

// DOM Elements
const authSection = document.getElementById("authSection");
const documentListSection = document.getElementById("documentListSection");
const documentEditorSection = document.getElementById("documentEditorSection");

const authForm = document.getElementById("authForm");
const authNameInput = document.getElementById("authName");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authMessage = document.getElementById("authMessage");
const toggleAuthModeBtn = document.getElementById("toggleAuthMode");
const logoutBtn = document.getElementById("logoutBtn");

const newDocumentBtn = document.getElementById("newDocumentBtn");
const documentListUl = document.getElementById("documentList");

const editorTitle = document.getElementById("editorTitle");
const documentContentTextarea = document.getElementById("documentContent");
const collaboratorsDisplay = document.getElementById("activeCollaborators");
const saveDocumentBtn = document.getElementById("saveDocumentBtn");
const backToListBtn = document.getElementById("backToListBtn");

let currentDocumentId = null;
let isRegisterMode = false;
let authToken = localStorage.getItem("token"); // Get token from local storage on load

// --- Utility Functions ---

function showSection(sectionId) {
  const sections = document.querySelectorAll("main section");
  sections.forEach((section) => {
    section.classList.remove("active-section");
    section.classList.add("hidden-section");
  });
  document.getElementById(sectionId).classList.remove("hidden-section");
  document.getElementById(sectionId).classList.add("active-section");
}

function displayMessage(element, message, type = "info") {
  element.textContent = message;
  element.className = `message ${type}`;
  if (message) {
    element.style.display = "block";
  } else {
    element.style.display = "none";
  }
}

// --- Authentication Logic ---

async function authenticateUser(e) {
  e.preventDefault();
  const email = authEmailInput.value;
  const password = authPasswordInput.value;
  const name = authNameInput.value;

  let url = isRegisterMode
    ? `${API_BASE_URL}/auth/register`
    : `${API_BASE_URL}/auth/login`;
  let body = isRegisterMode ? { email, password, name } : { email, password };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      displayMessage(authMessage, data.message || "Success!", "success");
      authToken = data.token;
      localStorage.setItem("token", authToken);
      logoutBtn.style.display = "block"; // Show logout button
      loadDocuments(); // Go to document list
    } else {
      displayMessage(
        authMessage,
        data.message || "Authentication failed.",
        "error"
      );
    }
  } catch (error) {
    console.error("Auth error:", error);
    displayMessage(authMessage, "Network error. Please try again.", "error");
  }
}

function toggleAuthForm() {
  isRegisterMode = !isRegisterMode;
  authNameInput.style.display = isRegisterMode ? "block" : "none";
  authSubmitBtn.textContent = isRegisterMode ? "Register" : "Login";
  toggleAuthModeBtn.textContent = isRegisterMode
    ? "Already have an account? Login here."
    : "Don't have an account? Register here.";
  authMessage.textContent = ""; // Clear message
}

function logout() {
  authToken = null;
  localStorage.removeItem("token");
  logoutBtn.style.display = "none";
  authForm.reset();
  showSection("authSection");
  displayMessage(authMessage, "Logged out successfully.", "success");
  // Disconnect socket if connected to a document
  if (currentDocumentId) {
    socket.emit("leave-document", currentDocumentId);
    currentDocumentId = null;
  }
  documentListUl.innerHTML = ""; // Clear document list
}

// --- Document List Logic ---

async function loadDocuments() {
  if (!authToken) {
    showSection("authSection");
    return;
  }
  showSection("documentListSection");
  documentListUl.innerHTML = "<li>Loading documents...</li>"; // Clear and show loading

  try {
    const response = await fetch(`${API_BASE_URL}/documents`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await response.json();

    if (response.ok) {
      documentListUl.innerHTML = ""; // Clear loading
      if (data.documents.length === 0) {
        documentListUl.innerHTML = "<li>No documents found. Create one!</li>";
        return;
      }
      data.documents.forEach((doc) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${doc.title}</span>
          <div>
            <button data-id="${doc.id}" class="open-doc-btn">Open</button>
            <button data-id="${doc.id}" class="delete-doc-btn delete-btn">Delete</button>
          </div>
        `;
        documentListUl.appendChild(li);
      });
    } else {
      displayMessage(
        documentListUl,
        data.message || "Failed to load documents.",
        "error"
      );
    }
  } catch (error) {
    console.error("Load documents error:", error);
    displayMessage(documentListUl, "Network error loading documents.", "error");
  }
}

async function createNewDocument() {
  const title = prompt("Enter a title for the new document:");
  if (!title) return;

  try {
    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ title, content: "" }), // Start with empty content
    });
    const data = await response.json();

    if (response.ok) {
      loadDocuments(); // Reload list to show new document
      // Optionally, open the new document directly: openDocument(data.document.id);
    } else {
      alert(data.message || "Failed to create document.");
    }
  } catch (error) {
    console.error("Create document error:", error);
    alert("Network error creating document.");
  }
}

async function deleteDocument(id) {
  if (!confirm("Are you sure you want to delete this document?")) return;

  try {
    const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (response.ok) {
      loadDocuments(); // Reload list
    } else {
      const data = await response.json();
      alert(data.message || "Failed to delete document.");
    }
  } catch (error) {
    console.error("Delete document error:", error);
    alert("Network error deleting document.");
  }
}

// --- Document Editor Logic ---

async function openDocument(documentId) {
  if (!authToken) {
    showSection("authSection");
    return;
  }

  currentDocumentId = documentId;
  showSection("documentEditorSection");

  try {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await response.json();

    if (response.ok) {
      editorTitle.textContent = data.document.title;
      documentContentTextarea.value = data.document.content;
      socket.emit("join-document", documentId); // Join Socket.IO room
      fetchCollaborators(documentId); // Load collaborators
    } else {
      alert(data.message || "Failed to load document.");
      showSection("documentListSection"); // Go back to list on error
    }
  } catch (error) {
    console.error("Open document error:", error);
    alert("Network error opening document.");
    showSection("documentListSection"); // Go back to list on network error
  }
}

async function fetchCollaborators(documentId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/documents/${documentId}/collaborators`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    const data = await response.json();

    if (response.ok) {
      const names = data.collaborators
        .map((c) => `${c.user.name} (${c.role.toLowerCase()})`)
        .join(", ");
      collaboratorsDisplay.textContent = names || "No other collaborators.";
    } else {
      console.error("Failed to fetch collaborators:", data.message);
      collaboratorsDisplay.textContent = "Error fetching collaborators.";
    }
  } catch (error) {
    console.error("Network error fetching collaborators:", error);
    collaboratorsDisplay.textContent = "Error fetching collaborators.";
  }
}

// --- Socket.IO Event Handlers ---

socket.on("connect", () => {
  console.log("Connected to WebSocket server.");
});

socket.on("disconnect", () => {
  console.log("Disconnected from WebSocket server.");
  // Handle UI changes for disconnection if needed
});

socket.on("document-updated", (data) => {
  if (data.documentId === currentDocumentId) {
    // Only update if it's the currently opened document
    const currentCursorPos = documentContentTextarea.selectionStart;
    const currentScrollPos = documentContentTextarea.scrollTop;
    documentContentTextarea.value = data.content;
    // Restore cursor position and scroll to provide a smoother experience
    documentContentTextarea.selectionStart = currentCursorPos;
    documentContentTextarea.selectionEnd = currentCursorPos;
    documentContentTextarea.scrollTop = currentScrollPos;
  }
});

socket.on("user-joined", (data) => {
  if (data.documentId === currentDocumentId) {
    console.log(`${data.userName} joined the document.`);
    fetchCollaborators(currentDocumentId); // Refresh collaborators list
  }
});

socket.on("user-left", (data) => {
  if (data.documentId === currentDocumentId) {
    console.log(`${data.userName} left the document.`);
    fetchCollaborators(currentDocumentId); // Refresh collaborators list
  }
});

// --- Event Listeners ---

authForm.addEventListener("submit", authenticateUser);
toggleAuthModeBtn.addEventListener("click", toggleAuthForm);
logoutBtn.addEventListener("click", logout);
newDocumentBtn.addEventListener("click", createNewDocument);
backToListBtn.addEventListener("click", () => {
  if (currentDocumentId) {
    socket.emit("leave-document", currentDocumentId); // Leave Socket.IO room
    currentDocumentId = null;
  }
  loadDocuments();
});

documentListUl.addEventListener("click", (e) => {
  if (e.target.classList.contains("open-doc-btn")) {
    openDocument(e.target.dataset.id);
  } else if (e.target.classList.contains("delete-doc-btn")) {
    deleteDocument(e.target.dataset.id);
  }
});

// Auto-save/real-time content update on input
let contentUpdateTimeout;
documentContentTextarea.addEventListener("input", () => {
  if (socket && currentDocumentId) {
    clearTimeout(contentUpdateTimeout);
    contentUpdateTimeout = setTimeout(() => {
      const content = documentContentTextarea.value;
      // Emit the document ID along with content for backend handler
      socket.emit("document-content-change", currentDocumentId, content);
      console.log(`Auto-saving document ${currentDocumentId} content...`);
    }, 1000); // Wait 1 second after user stops typing
  }
});

// Initial load check
document.addEventListener("DOMContentLoaded", () => {
  if (authToken) {
    logoutBtn.style.display = "block";
    loadDocuments();
  } else {
    showSection("authSection");
  }
});
