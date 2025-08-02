import requests
data  = requests.get('http://127.0.0.1:5003/send-url?url=https://www.gdtv.cn/tvChannelDetail/45')
print(data.text)