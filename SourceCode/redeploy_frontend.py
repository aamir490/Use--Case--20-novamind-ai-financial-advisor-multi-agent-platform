import boto3, zipfile, os, requests, time

region = 'us-east-1'
app_name = 'finance-advisor-ui'
out_dir = 'frontend/out'

client = boto3.client('amplify', region_name=region)

# Find existing app
apps = client.list_apps()
app_id = None
for app in apps.get('apps', []):
    if app['name'] == app_name:
        app_id = app['appId']
        break

if not app_id:
    print("App not found. Run deploy first.")
    exit(1)

print(f"Found Amplify app: {app_id}")

# Update environment variables with correct Cognito config
client.update_app(
    appId=app_id,
    environmentVariables={
        'NEXT_PUBLIC_COGNITO_USER_POOL_ID': 'us-east-1_9UiP5fHLR',
        'NEXT_PUBLIC_COGNITO_CLIENT_ID': '5rlmejlihup613hnuhe39t5drh',
        'NEXT_PUBLIC_COGNITO_REGION': 'us-east-1'
    }
)
print("Environment variables updated")

# Zip the out/ directory
zip_path = 'amplify-frontend.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(out_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, out_dir)
            zf.write(file_path, arcname)

print(f"Zip created: {os.path.getsize(zip_path) / 1024:.1f} KB")

# Create deployment and upload
deploy = client.create_deployment(appId=app_id, branchName='main')
upload_url = deploy['zipUploadUrl']
job_id = deploy['jobId']

requests.put(upload_url, data=open(zip_path, 'rb'))
print("Artifacts uploaded")

client.start_deployment(appId=app_id, branchName='main', jobId=job_id)

# Wait for completion
status = 'PENDING'
while status in ('PENDING', 'RUNNING'):
    time.sleep(10)
    job = client.get_job(appId=app_id, branchName='main', jobId=job_id)
    status = job['job']['summary']['status']
    print(f"Status: {status}")

if status == 'SUCCEED':
    print(f"\nDone! URL: https://main.{app_id}.amplifyapp.com")
    print("Username: admin")
    print("Password: Finance@2026")
else:
    print(f"Deployment failed: {status}")
