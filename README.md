# WMS ROI Assessment Calculator

A simplified Warehouse Management System ROI calculator designed for Netlify deployment. This application helps logistics professionals calculate potential return on investment from implementing a WMS.

## Features

- **Simple Questionnaire**: Single-page form collecting essential warehouse metrics
- **Automated ROI Calculations**: Industry-standard calculations for:
  - Labor efficiency savings
  - Overtime reduction
  - Space optimization
  - Accuracy improvements
  - Inventory optimization
  - Productivity gains
- **Instant Results**: Real-time ROI calculations with detailed breakdown
- **Serverless Architecture**: Netlify Functions for scalable backend
- **MongoDB Atlas**: Cloud database for assessment storage

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Netlify Functions (Node.js)
- **Database**: MongoDB Atlas with Mongoose
- **Deployment**: Netlify

## Project Structure

```
roi-warehouse-assessment/
├── netlify/
│   └── functions/
│       ├── models/
│       │   └── Assessment.js          # MongoDB schema
│       ├── utils/
│       │   ├── db.js                  # Database connection
│       │   └── roiCalculator.js       # ROI calculation logic
│       ├── create-assessment.js       # Create assessment endpoint
│       ├── get-assessment.js          # Get single assessment
│       └── list-assessments.js        # List all assessments
├── public/
│   ├── index.html                     # Main application UI
│   └── app.js                         # Frontend logic
├── netlify.toml                       # Netlify configuration
├── package.json                       # Dependencies
├── .env.example                       # Environment variables template
└── README.md                          # This file
```

## Setup Instructions

### 1. Prerequisites

- Node.js 14+ installed
- MongoDB Atlas account
- Netlify account
- Git installed

### 2. MongoDB Atlas Setup

1. Create a free MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster (free tier is sufficient)
3. Create a database user with read/write permissions
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)

### 3. Local Development

1. Clone the repository:
```bash
cd D:\Cascade\WMSROINEW\roi-warehouse-assessment
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Edit `.env` and add your MongoDB connection string:
```
MONGODB_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/wms_roi?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=development
```

5. Start development server:
```bash
npm run dev
```

6. Open browser to `http://localhost:8888`

### 4. Netlify Deployment

#### Option A: Deploy via Netlify CLI

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Login to Netlify:
```bash
netlify login
```

3. Initialize site:
```bash
netlify init
```

4. Set environment variables:
```bash
netlify env:set MONGODB_URI "your-mongodb-connection-string"
netlify env:set JWT_SECRET "your-secret-key"
netlify env:set NODE_ENV "production"
```

5. Deploy:
```bash
netlify deploy --prod
```

#### Option B: Deploy via Netlify Dashboard

1. Push code to GitHub repository
2. Go to https://app.netlify.com
3. Click "New site from Git"
4. Connect your GitHub repository
5. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
6. Add environment variables in Netlify dashboard:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Your secret key
   - `NODE_ENV`: `production`
7. Click "Deploy site"

## API Endpoints

### Create Assessment
- **Endpoint**: `POST /.netlify/functions/create-assessment`
- **Description**: Submit questionnaire and calculate ROI
- **Request Body**:
```json
{
  "companyName": "string",
  "contactEmail": "string",
  "annualRevenue": number,
  "warehouseSquareFeet": number,
  "numberOfEmployees": number,
  "dailyOrderVolume": number,
  "currentPickAccuracy": number,
  "averagePickTime": number,
  "inventoryTurnover": number,
  "spaceUtilization": number,
  "laborCostPercentage": number,
  "overtimePercentage": number,
  "primaryChallenges": ["string"],
  "technologyGaps": "string"
}
```

### Get Assessment
- **Endpoint**: `GET /.netlify/functions/get-assessment?id={assessmentId}`
- **Description**: Retrieve a specific assessment by ID

### List Assessments
- **Endpoint**: `GET /.netlify/functions/list-assessments?limit=50&skip=0`
- **Description**: List all assessments with pagination

## ROI Calculation Methodology

The calculator uses industry benchmarks to estimate potential improvements:

### Benchmarks Used
- **Target Pick Accuracy**: 99.5%
- **Target Pick Time**: 45 seconds per pick
- **Target Space Utilization**: 85%
- **Target Inventory Turnover**: 8 times/year
- **Target Overtime**: 5% of hours

### Calculations

1. **Labor Efficiency Savings**: Based on productivity improvement from reduced pick times
2. **Overtime Reduction**: Savings from reducing overtime to industry benchmark
3. **Space Optimization**: Value of reclaimed warehouse space
4. **Accuracy Improvement**: Cost savings from error reduction
5. **Inventory Optimization**: Reduced carrying costs from improved turnover
6. **Productivity Gain**: Additional revenue from increased capacity

### Implementation Cost
Estimated based on warehouse size and complexity:
- Base cost: $50,000
- Adjusted for warehouse size and employee count

## Customization

### Modify ROI Calculations
Edit `netlify/functions/utils/roiCalculator.js` to adjust:
- Industry benchmarks
- Calculation formulas
- Cost assumptions

### Modify Questionnaire
Edit `public/index.html` to:
- Add/remove form fields
- Change validation rules
- Update styling

### Add New Endpoints
Create new files in `netlify/functions/` following the existing pattern.

## Troubleshooting

### Database Connection Issues
- Verify MongoDB Atlas connection string is correct
- Check IP whitelist in MongoDB Atlas
- Ensure database user has proper permissions

### Netlify Function Errors
- Check Netlify function logs in dashboard
- Verify environment variables are set
- Ensure all dependencies are in package.json

### CORS Errors
- CORS headers are configured in netlify.toml
- Check browser console for specific errors

## Support

For issues or questions:
1. Check Netlify function logs
2. Verify environment variables
3. Review MongoDB Atlas connection
4. Check browser console for frontend errors

## License

MIT License - feel free to modify and use for your projects.
