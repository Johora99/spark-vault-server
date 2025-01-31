# SparkVault

The **SparkVault** backend is built using Node.js and Express, providing the core API services for managing products, users, and interactions on the platform. It connects to a MongoDB database for data storage and is designed to handle scalable operations efficiently.

## Features

- **RESTful API Endpoints:** CRUD operations for products, users, and interactions.
- **Authentication and Authorization:** Secure user authentication with JWT.
- **Database Integration:** MongoDB for efficient and scalable data storage.
- **Error Handling:** Centralized error handling for API endpoints.
- **Environment Configurations:** Easily configurable environment variables for seamless deployment.

## Tech Stack

- **Backend Framework:** Node.js, Express
- **Database:** MongoDB
- **Authentication:** JWT (JSON Web Tokens)
- **Environment Management:** dotenv

## Installation and Setup

Follow these steps to set up the backend locally:

### Prerequisites
- Node.js and npm installed on your machine
- MongoDB setup locally or via a cloud provider (e.g., MongoDB Atlas)

### Steps

1. Clone the repository:
   ```bash
   git clone <backend-repo-url>
   cd <backend-folder>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

The backend server will be available at `http://localhost:5000`.

## API Endpoints

| Method | Endpoint          | Description                      |
|--------|-------------------|----------------------------------|
| GET    | /api/products     | Fetch all products              |
| POST   | /api/products     | Add a new product               |
| GET    | /api/products/:id | Fetch product details by ID     |
| PUT    | /api/products/:id | Update product details by ID    |
| DELETE | /api/products/:id | Delete a product by ID          |
| POST   | /api/auth/signup  | Register a new user             |
| POST   | /api/auth/login   | User login                      |

## Error Handling

The backend includes centralized error handling to ensure consistent API responses. Errors are returned with appropriate HTTP status codes and messages.



## 🔗 Links
Live Link : https://spark-vault.netlify.app/
