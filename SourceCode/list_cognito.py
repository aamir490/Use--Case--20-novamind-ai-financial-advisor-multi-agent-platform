import boto3

client = boto3.client('cognito-idp', region_name='us-east-1')
pools = client.list_user_pools(MaxResults=10)

for pool in pools['UserPools']:
    print(f"Pool: {pool['Name']} | ID: {pool['Id']}")
    clients = client.list_user_pool_clients(UserPoolId=pool['Id'], MaxResults=10)
    for c in clients['UserPoolClients']:
        print(f"  Client: {c['ClientName']} | ID: {c['ClientId']}")
