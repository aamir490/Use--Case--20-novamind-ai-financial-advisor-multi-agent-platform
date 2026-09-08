import boto3
import requests

region = 'us-east-1'
client = boto3.client('amplify', region_name=region)
app_id = 'd2en0ke68ba345'

# Test the URL directly
url = f"https://main.{app_id}.amplifyapp.com"
try:
    resp = requests.get(url, timeout=10)
    print(f"URL Status: {resp.status_code}")
    print(f"Content length: {len(resp.content)}")
except Exception as e:
    print(f"URL Error: {e}")

# Check app domain
app = client.get_app(appId=app_id)['app']
print(f"\nDefault Domain: {app['defaultDomain']}")
print(f"Platform: {app.get('platform')}")

# List domain associations
try:
    domains = client.list_domain_associations(appId=app_id)
    print(f"Domain associations: {domains.get('domainAssociations', [])}")
except Exception as e:
    print(f"Domain error: {e}")

# Check all jobs
jobs = client.list_jobs(appId=app_id, branchName='main', maxResults=5)
print("\nAll jobs:")
for job in jobs['jobSummaries']:
    print(f"  Job {job['jobId']}: {job['status']} | Type: {job['jobType']}")
