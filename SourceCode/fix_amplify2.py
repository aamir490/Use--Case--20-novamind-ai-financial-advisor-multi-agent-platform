import boto3

region = 'us-east-1'
client = boto3.client('amplify', region_name=region)
app_id = 'd2en0ke68ba345'

# Update branch to PRODUCTION stage
client.update_branch(
    appId=app_id,
    branchName='main',
    stage='PRODUCTION',
    framework='Next.js - SSG',
    enableAutoBuild=True
)
print("Branch updated to PRODUCTION")

# Update app platform to WEB
client.update_app(
    appId=app_id,
    platform='WEB',
    customRules=[
        {'source': '/<*>', 'target': '/index.html', 'status': '404-200'},
        {'source': '/index.html', 'target': '/index.html', 'status': '200'}
    ]
)
print("App platform set to WEB")
print(f"\nTry opening: https://main.{app_id}.amplifyapp.com")
