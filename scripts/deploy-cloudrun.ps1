# Usage: .\deploy-cloudrun.ps1 -ProjectId <PROJECT_ID> -ServiceName <SERVICE_NAME> -Region <REGION>
param(
  [Parameter(Mandatory=$true)] [string]$ProjectId,
  [Parameter(Mandatory=$true)] [string]$ServiceName,
  [Parameter(Mandatory=$false)] [string]$Region = 'us-central1',
  [Parameter(Mandatory=$false)] [string]$ImageTag = 'v1'
)

Write-Host "Building frontend and server..."
npm run build

Write-Host "Building container and submitting to Google Cloud Build..."
$fullImage = "gcr.io/$ProjectId/${ServiceName}:$ImageTag"
gcloud builds submit --tag $fullImage

Write-Host "Deploying to Cloud Run ($ServiceName) in $Region..."
gcloud run deploy $ServiceName --image=$fullImage --platform=managed --region=$Region --allow-unauthenticated --project=$ProjectId

Write-Host "Deployment complete. Update firebase.json rewrite 'serviceId' to '$ServiceName' and run 'firebase deploy --only hosting' to update hosting rewrites."