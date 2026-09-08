import boto3

region = 'us-east-1'
client = boto3.client('amplify', region_name=region)
app_id = 'd2en0ke68ba345'

# Get job details
job = client.get_job(appId=app_id, branchName='main', jobId='6')
print("Job status:", job['job']['summary']['status'])
print("Commit message:", job['job']['summary'].get('commitMessage', 'N/A'))

# List artifacts
for step in job['job'].get('steps', []):
    print(f"Step: {step['stepName']} | Status: {step['status']}")
    if step.get('logUrl'):
        print(f"  Log: {step['logUrl']}")

# Check branch
branch = client.get_branch(appId=app_id, branchName='main')
print("\nBranch info:")
print(f"  Active job: {branch['branch'].get('activeJobId', 'N/A')}")
print(f"  Framework: {branch['branch'].get('framework', 'N/A')}")
print(f"  Total files: {branch['branch'].get('totalNumberOfJobs', 'N/A')}")
