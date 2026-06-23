# 🛡️ InfraSight

> Understand Infrastructure Before Deployment.

InfraSight helps developers and cloud teams analyze Terraform infrastructure before deployment. It identifies security risks, highlights cost optimization opportunities, generates assessment reports, and provides AI-powered remediation guidance.

---

## ✨ Features

### 🔍 Terraform Infrastructure Analysis

* Upload and analyze Terraform files
* Discover infrastructure resources
* Generate infrastructure insights

### 🛡️ Security Assessment

* Detect cloud security misconfigurations
* Classify findings by severity
* Provide remediation recommendations

### 💰 Cost Optimization

* Identify inefficient cloud resources
* Estimate potential cost savings
* Highlight optimization opportunities

### 🤖 AI Security Advisor

* Gemini-powered recommendations
* Terraform best practices
* Security guidance and explanations

### 📄 PDF Report Generation

* Security assessment reports
* Cost optimization reports
* Complete infrastructure reports

### 👤 Authentication

* Google OAuth Login
* Email & Password Login
* JWT Authentication
* Session Management

### 🏢 Admin Control Center

* User Management
* Role Management
* Audit Logs
* Security Telemetry
* Login Monitoring

---

## 🏗️ Architecture

```text
User
  │
  ▼
React + TypeScript Frontend
  │
  ▼
FastAPI Backend
  │
  ├── Authentication Service
  ├── Terraform Analysis Engine
  ├── Security Scanner
  ├── Cost Optimization Engine
  ├── AI Security Advisor
  ├── PDF Report Generator
  └── Admin Control Center
  │
  ▼
MySQL Database
  │
  ▼
Docker Containers
  │
  ▼
AWS EC2
```

---

## 🛠️ Tech Stack

| Category               | Technologies             |
| ---------------------- | ------------------------ |
| Frontend               | React, TypeScript, Vite  |
| Backend                | FastAPI, Python          |
| Database               | MySQL 8, SQLite Fallback |
| Authentication         | Google OAuth, JWT        |
| AI                     | Google Gemini            |
| Cloud                  | AWS EC2                  |
| Containers             | Docker, Docker Compose   |
| Infrastructure as Code | Terraform                |
| CI/CD                  | GitHub Actions           |
| Version Control        | Git, GitHub              |

---

## 🚀 CI/CD & Deployment

### 🧪 CI Validation

* Frontend & Backend Linting
* Automated Testing
* Build Verification

### 🚀 Application Deployment

* Build Docker Images
* Push Images to Docker Hub
* Deploy to AWS EC2
* Health Verification

### 🏗️ Infrastructure Provisioning

* Terraform Plan
* Terraform Apply
* Infrastructure Deployment

---

## 🗄️ Database

**Primary Database**

* MySQL 8

**Fallback Database**

* SQLite

The application attempts to connect to MySQL first. If unavailable during development, it automatically falls back to SQLite.

---

## 🔐 Security Features

* JWT Authentication
* Google OAuth Integration
* Role-Based Access Control (RBAC)
* Protected Admin Routes
* Audit Logging
* Failed Login Monitoring
* Security Telemetry Dashboard
* Session Tracking

---

## ⚙️ Local Setup

### Clone Repository

```bash
git clone https://github.com/YuvarajOfl/InfraSight.git
cd InfraSight
```

### Backend Setup

```bash
cd backend

pip install -r requirements.txt

uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

### Docker Setup

```bash
docker compose up -d
```

---

## 📸 Screenshots

### Dashboard

![Dashboard](<img width="1920" height="1080" alt="Screenshot (820)" src="https://github.com/user-attachments/assets/7cb49d33-b6b8-4397-b3af-22d739898d98" />)

### Infrastructure Analysis

![Infrastructure Analysis](docs/images/analysis.png)

### AI Security Advisor

![AI Advisor](<img width="1920" height="1080" alt="Screenshot (819)" src="https://github.com/user-attachments/assets/b2addb98-cf09-4389-90b8-685e6dd337d7" />
)

### Reports

![Reports](<img width="1920" height="1080" alt="Screenshot (821)" src="https://github.com/user-attachments/assets/704e58f3-2f83-418d-aa9e-a7ee8a05c787" />
)

### Admin Control Center

![Admin Panel](<img width="1920" height="1080" alt="Screenshot (823)" src="https://github.com/user-attachments/assets/b9153e40-4eb5-4c88-923e-2b76bced1efc" />
)

---

## 🎯 Learning Outcomes

This project demonstrates practical experience with:

* Cloud Security
* Terraform
* FastAPI
* React
* Docker
* GitHub Actions
* AWS EC2
* Authentication Systems
* RBAC
* DevOps Practices

---

## 🔮 Future Improvements

* PostgreSQL Support
* AWS RDS Integration
* Amazon S3 Report Storage
* Advanced Security Rules
* Real-Time Monitoring
* Multi-Tenant Organizations

---

## 👨‍💻 Author

**Yuvaraj**

* GitHub: https://github.com/YuvarajOfl
* LinkedIn: https://www.linkedin.com/in/yuvaraj8/

---

## 📄 License

This project is licensed under the MIT License.

---

⭐ If you found this project useful, consider giving it a star.
