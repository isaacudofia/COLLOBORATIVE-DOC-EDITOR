// Configuration for the frontend application
const config = {
  // API base URL - falls back to localhost in development
  apiUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:4000/api"
      : "https://collab-doc-editor-u3w6.onrender.com",

  // Socket.IO URL - falls back to localhost in development
  socketUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:4000"
      : "https://collab-doc-editor-u3w6.onrender.com",
};

export default config;
