# Client APIs – Endpoints, Payloads & Responses

**Base URL:** `http://localhost:3000/api` (or your `PORT` and `API_PREFIX`)

**Auth:** Send JWT in header: `Authorization: Bearer <accessToken>`

---

## 1. Client self-registration (public)

**POST** `/api/clients/register`

**Auth:** None

### Request body

```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "mobileNumber": "string",
  "password": "string",
  "confirmPassword": "string"
}
```

| Field            | Type   | Required | Rules                          |
|------------------|--------|----------|--------------------------------|
| firstName        | string | Yes      | -                              |
| lastName         | string | Yes      | -                              |
| email            | string | Yes      | Valid email                    |
| mobileNumber     | string | Yes      | Exactly 10 digits              |
| password         | string | Yes      | Min 6 characters               |
| confirmPassword  | string | Yes      | Must match password            |

### Response (201)

```json
{
  "code": 201,
  "message": "Client registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "string",
      "email": "string",
      "role": "CLIENT_ADMIN",
      "client": { "id": "uuid", "companyName": "...", "email": "...", ... },
      "createdAt": "ISO date"
    },
    "client": {
      "id": "uuid",
      "companyName": "string",
      "email": "string",
      "contactPerson": "string",
      "phone": "string",
      "createdAt": "ISO date"
    }
  }
}
```

---

## 2. Add client (Super Admin only)

**POST** `/api/clients`

**Auth:** Bearer token, role **SUPER_ADMIN**

### Request body

```json
{
  "bankVendorType": "string",
  "bankVendorName": "string",
  "mobileNumber": "9876543210",
  "email": "vendor@example.com",
  "natureOfServices": "string",
  "address": "string",
  "pinCode": "560001",
  "country": "India",
  "state": "string",
  "city": "string",
  "bankName": "string",
  "accountHolderName": "string",
  "accountNumber": "string",
  "ifscCode": "SBIN0001234",
  "branchName": "string",
  "panNumber": "string",
  "panDocumentUrl": "string",
  "gstNumber": "string",
  "gstDocumentUrl": "string",
  "addressProofUrl": "string",
  "cancelledChequeUrl": "string",
  "taxApprovalUrl": "string",
  "agreementDocumentUrl": "string",
  "attachment1Url": "string",
  "attachment2Url": "string",
  "dsaTrainingAcknowledgeUrl": "string",
  "approvedAttachmentUrl": "string",
  "dueDiligenceDocumentUrl": "string"
}
```

**Required:**  
`bankVendorType`, `bankVendorName`, `mobileNumber`, `email`, `natureOfServices`, `address`, `pinCode`, `state`, `city`, `bankName`, `accountHolderName`, `accountNumber`, `ifscCode`

**Optional:**  
`country` (default India), `branchName`, and all document fields above.

| Field   | Rules                    |
|---------|--------------------------|
| mobileNumber | 10 digits            |
| email   | Valid email              |
| pinCode | 6 digits                 |
| ifscCode| e.g. SBIN0001234         |

### Response (201)

```json
{
  "code": 201,
  "message": "Client created successfully",
  "data": {
    "id": "uuid",
    "companyName": "string",
    "email": "string",
    "contactPerson": "string",
    "phone": "string",
    "bankVendorType": "string",
    "bankVendorName": "string",
    "mobileNumber": "string",
    "natureOfServices": "string",
    "address": "string",
    "pinCode": "string",
    "country": "string",
    "state": "string",
    "city": "string",
    "bankName": "string",
    "accountHolderName": "string",
    "accountNumber": "string",
    "ifscCode": "string",
    "branchName": "string",
    "panNumber": "string",
    "panDocumentUrl": "string",
    "gstNumber": "string",
    "gstDocumentUrl": "string",
    "addressProofUrl": "string",
    "cancelledChequeUrl": "string",
    "taxApprovalUrl": "string",
    "agreementDocumentUrl": "string",
    "attachment1Url": "string",
    "attachment2Url": "string",
    "dsaTrainingAcknowledgeUrl": "string",
    "approvedAttachmentUrl": "string",
    "dueDiligenceDocumentUrl": "string",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

---

## 3. List clients (Super Admin only)

**GET** `/api/clients`

**Auth:** Bearer token, role **SUPER_ADMIN**

### Query parameters

| Param  | Type   | Default | Description                    |
|--------|--------|--------|--------------------------------|
| page   | number | 1      | Page number                    |
| limit  | number | 10     | Items per page (max 100)       |
| search | string | -      | Search in name, email, mobile  |

**Example:** `GET /api/clients?page=1&limit=10&search=acme`

### Response (200)

```json
{
  "code": 200,
  "message": "Clients fetched successfully",
  "data": [
    {
      "id": "uuid",
      "companyName": "string",
      "email": "string",
      "contactPerson": "string",
      "phone": "string",
      "bankVendorType": "string",
      "bankVendorName": "string",
      "mobileNumber": "string",
      "natureOfServices": "string",
      "address": "string",
      "pinCode": "string",
      "country": "string",
      "state": "string",
      "city": "string",
      "bankName": "string",
      "accountHolderName": "string",
      "accountNumber": "string",
      "ifscCode": "string",
      "branchName": "string",
      "panNumber": "string",
      "panDocumentUrl": "string",
      "gstNumber": "string",
      "gstDocumentUrl": "string",
      "addressProofUrl": "string",
      "cancelledChequeUrl": "string",
      "taxApprovalUrl": "string",
      "agreementDocumentUrl": "string",
      "attachment1Url": "string",
      "attachment2Url": "string",
      "dsaTrainingAcknowledgeUrl": "string",
      "approvedAttachmentUrl": "string",
      "dueDiligenceDocumentUrl": "string",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "pagePerRecord": 10
  }
}
```

---

## 4. Get client by ID

**GET** `/api/clients/:id`

**Auth:** Bearer token, role **SUPER_ADMIN** or **CLIENT_ADMIN**  
- **CLIENT_ADMIN** can only request their own client (`id` = their `clientId`).

### Path parameters

| Param | Type   | Description   |
|-------|--------|----------------|
| id    | string | Client UUID   |

**Example:** `GET /api/clients/550e8400-e29b-41d4-a716-446655440000`

### Response (200)

```json
{
  "code": 200,
  "message": "Client details fetched successfully",
  "data": {
    "id": "uuid",
    "companyName": "string",
    "email": "string",
    "contactPerson": "string",
    "phone": "string",
    "bankVendorType": "string",
    "bankVendorName": "string",
    "mobileNumber": "string",
    "natureOfServices": "string",
    "address": "string",
    "pinCode": "string",
    "country": "string",
    "state": "string",
    "city": "string",
    "bankName": "string",
    "accountHolderName": "string",
    "accountNumber": "string",
    "ifscCode": "string",
    "branchName": "string",
    "panNumber": "string",
    "panDocumentUrl": "string",
    "gstNumber": "string",
    "gstDocumentUrl": "string",
    "addressProofUrl": "string",
    "cancelledChequeUrl": "string",
    "taxApprovalUrl": "string",
    "agreementDocumentUrl": "string",
    "attachment1Url": "string",
    "attachment2Url": "string",
    "dsaTrainingAcknowledgeUrl": "string",
    "approvedAttachmentUrl": "string",
    "dueDiligenceDocumentUrl": "string",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

**Error (404):** `{ "statusCode": 404, "message": "Client not found" }`  
**Error (403):** `{ "statusCode": 403, "message": "You can only view your own client details" }`

---

## 5. Update client

**PATCH** `/api/clients/:id`

**Auth:** Bearer token, role **SUPER_ADMIN** or **CLIENT_ADMIN**  
- **CLIENT_ADMIN** can only update their own client.

### Path parameters

| Param | Type   | Description   |
|-------|--------|----------------|
| id    | string | Client UUID   |

### Request body (all fields optional)

Send only the fields you want to change.

```json
{
  "bankVendorType": "string",
  "bankVendorName": "string",
  "mobileNumber": "9876543210",
  "email": "vendor@example.com",
  "natureOfServices": "string",
  "address": "string",
  "pinCode": "560001",
  "country": "string",
  "state": "string",
  "city": "string",
  "bankName": "string",
  "accountHolderName": "string",
  "accountNumber": "string",
  "ifscCode": "SBIN0001234",
  "branchName": "string",
  "panNumber": "string",
  "panDocumentUrl": "string",
  "gstNumber": "string",
  "gstDocumentUrl": "string",
  "addressProofUrl": "string",
  "cancelledChequeUrl": "string",
  "taxApprovalUrl": "string",
  "agreementDocumentUrl": "string",
  "attachment1Url": "string",
  "attachment2Url": "string",
  "dsaTrainingAcknowledgeUrl": "string",
  "approvedAttachmentUrl": "string",
  "dueDiligenceDocumentUrl": "string"
}
```

Same validation rules as create for any field you send (e.g. `mobileNumber` 10 digits, `pinCode` 6 digits, `ifscCode` format).

### Response (200)

```json
{
  "code": 200,
  "message": "Client updated successfully",
  "data": {
    "id": "uuid",
    "companyName": "string",
    "email": "string",
    "contactPerson": "string",
    "phone": "string",
    "bankVendorType": "string",
    "bankVendorName": "string",
    "mobileNumber": "string",
    "natureOfServices": "string",
    "address": "string",
    "pinCode": "string",
    "country": "string",
    "state": "string",
    "city": "string",
    "bankName": "string",
    "accountHolderName": "string",
    "accountNumber": "string",
    "ifscCode": "string",
    "branchName": "string",
    "panNumber": "string",
    "panDocumentUrl": "string",
    "gstNumber": "string",
    "gstDocumentUrl": "string",
    "addressProofUrl": "string",
    "cancelledChequeUrl": "string",
    "taxApprovalUrl": "string",
    "agreementDocumentUrl": "string",
    "attachment1Url": "string",
    "attachment2Url": "string",
    "dsaTrainingAcknowledgeUrl": "string",
    "approvedAttachmentUrl": "string",
    "dueDiligenceDocumentUrl": "string",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

**Error (404):** `{ "statusCode": 404, "message": "Client not found" }`  
**Error (403):** `{ "statusCode": 403, "message": "You can only update your own client details" }`  
**Error (409):** `{ "statusCode": 409, "message": "A client with this email already exists" }` (when changing `email` to an existing one)

---

## Summary

| Method | Endpoint               | Auth        | Description        |
|--------|------------------------|------------|--------------------|
| POST   | `/api/clients/register` | None       | Client self-register |
| POST   | `/api/clients`         | SUPER_ADMIN | Add client        |
| GET    | `/api/clients`         | SUPER_ADMIN | List clients      |
| GET    | `/api/clients/:id`     | SUPER_ADMIN / CLIENT_ADMIN (own) | Get client by ID |
| PATCH  | `/api/clients/:id`     | SUPER_ADMIN / CLIENT_ADMIN (own) | Update client    |

**Login:** Use **POST** `/api/auth/login` with `{ "email": "...", "password": "..." }` to get `accessToken` for protected endpoints.
