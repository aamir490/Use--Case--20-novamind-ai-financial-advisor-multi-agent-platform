import boto3

region = 'us-east-1'
client = boto3.client('amplify', region_name=region)
app_id = 'd2en0ke68ba345'

# Get full app details
app = client.get_app(appId=app_id)['app']
print(f"App Name: {app['name']}")
print(f"Default Domain: {app['defaultDomain']}")
print(f"Repository: {app.get('repository', 'N/A')}")
print(f"Platform: {app.get('platform', 'N/A')}")

# Get branch details
branch = client.get_branch(appId=app_id, branchName='main')['branch']
print(f"\nBranch: main")
print(f"  Display Name: {branch.get('displayName')}")
print(f"  Active Job ID: {branch.get('activeJobId', 'N/A')}")
print(f"  Framework: {branch.get('framework', 'N/A')}")
print(f"  Status: {branch.get('stage', 'N/A')}")
print(f"  Enable Auto Build: {branch.get('enableAutoBuild', 'N/A')}")

# Get job 6 steps
job = client.get_job(appId=app_id, branchName='main', jobId='6')
print(f"\nJob 6 Steps:")
for step in job['job'].get('steps', []):
    print(f"  {step['stepName']}: {step['status']}")
