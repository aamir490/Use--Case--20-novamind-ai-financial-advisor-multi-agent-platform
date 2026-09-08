import boto3

region = 'us-east-1'
app_name = 'finance-advisor-ui'

client = boto3.client('amplify', region_name=region)

# List all apps
apps = client.list_apps()
for app in apps.get('apps', []):
    print(f"App: {app['name']} | ID: {app['appId']}")
    print(f"  Default Domain: {app.get('defaultDomain', 'N/A')}")
    print(f"  Status: {app.get('productionBranch', {}).get('status', 'N/A')}")

    # Get branches
    try:
        branches = client.list_branches(appId=app['appId'])
        for branch in branches.get('branches', []):
            print(f"  Branch: {branch['branchName']} | Status: {branch['displayName']}")
            print(f"  URL: https://{branch['branchName']}.{app['appId']}.amplifyapp.com")

        # Get latest job
        jobs = client.list_jobs(appId=app['appId'], branchName='main', maxResults=1)
        for job in jobs.get('jobSummaries', []):
            print(f"  Latest Job: {job['jobId']} | Status: {job['status']}")
    except Exception as e:
        print(f"  Error: {e}")
