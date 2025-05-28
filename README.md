# Real-time Collaborative Document Editor

A real-time collaborative document editor that allows multiple users to simultaneously edit documents with instant synchronization and live collaboration features.

## Features

- 🔐 **User Authentication**

  - Register and login functionality
  - JWT-based authentication
  - Secure password hashing

- 📝 **Document Management**

  - Create, read, update, and delete documents
  - Real-time document editing
  - Auto-saving functionality
  - Document ownership and access control

- 👥 **Collaboration Features**
  - Multi-user real-time editing
  - Role-based access control (Owner, Editor, Viewer)
  - Add/remove collaborators
  - See active collaborators
  - Real-time updates for all connected users

## Technology Stack

- **Frontend:**

  - HTML/CSS/JavaScript
  - Socket.IO Client
  - Pure CSS for styling

- **Backend:**

  - Node.js
  - Express.js
  - Socket.IO
  - Prisma ORM
  - PostgreSQL
  - JWT for authentication

- **DevOps:**
  - Docker
  - Docker Compose
  - Container orchestration

## Prerequisites

- Node.js (v14 or higher)
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL (v12 or higher)
- npm (Node Package Manager)

## Installation and Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd colloborative-doc-editor
```

2. Install dependencies:

```bash
npm install
```

3. Set up your environment variables:
   Create a `.env` file in the root directory with the following content:

```env
PORT=4000
DATABASE_URL="postgresql://username:password@localhost:5432/your_database_name?schema=public"
JWT_PRIVATE_KEY="your-secret-key"
```

4. Set up the database:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

5. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:4000`

### Using Docker

1. Build and start the containers:

```bash
docker-compose up --build
```

2. Run migrations in the Docker container:

```bash
docker-compose exec app npx prisma migrate deploy
```

3. Stop the containers:

```bash
docker-compose down
```

#### Docker Compose Services

- `app`: Node.js application
- `db`: PostgreSQL database
- Configured with automatic restart and volume persistence

## Database Schema

### User

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  password      String
  name          String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  documents     Document[]
  collaborations Collaboration[]
}
```

### Document

```prisma
model Document {
  id            String         @id @default(uuid())
  title         String
  content       String         @default("")
  ownerId       String
  owner         User           @relation(fields: [ownerId], references: [id])
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  collaborators Collaboration[]
}
```

### Collaboration

```prisma
model Collaboration {
  id          String   @id @default(uuid())
  userId      String
  documentId  String
  role        Role     @default(EDITOR)
  user        User     @relation(fields: [userId], references: [id])
  document    Document @relation(fields: [documentId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, documentId])
}

enum Role {
  OWNER
  EDITOR
  VIEWER
}
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Documents

- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get specific document
- `POST /api/documents` - Create new document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document

### Collaboration

- `POST /api/documents/:documentId/collaborators` - Add collaborator
- `DELETE /api/documents/:documentId/collaborators/:collaboratorId` - Remove collaborator
- `GET /api/documents/:documentId/collaborators` - Get document collaborators

## UI Screenshots

### Authentication

![Authentication](ui_screenshots/auth.png)
_Login and Registration interface_

### Document List

![Document List](ui_screenshots/document_list.png)
_List of user's documents and shared documents_

### Document Editor

![Document Editor](ui_screenshots/document_editor.png)
_Real-time collaborative document editor with collaborator management_

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
