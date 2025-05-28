// Configuration for the frontend application
const config = {
  // API base URL - falls back to localhost in development
  apiUrl:
    process.env.NODE_ENV === "production"
      ? process.env.API_URL || "https://your-backend-url.com/api"
      : "http://localhost:4000/api",

  // Socket.IO URL - falls back to localhost in development
  socketUrl:
    process.env.NODE_ENV === "production"
      ? process.env.SOCKET_URL || "https://your-backend-url.com"
      : "http://localhost:4000",
};

export default config;
