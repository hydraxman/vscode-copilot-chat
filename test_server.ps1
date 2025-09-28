Add-Type -AssemblyName System.Net.Http

$uri  = 'http://127.0.0.1:3899/chat'
$body = '{"prompt":"give me 3 types of A* algo implementations"}'

$req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $uri)
$req.Headers.Accept.ParseAdd('text/event-stream')

# 先创建 Content，再访问它的 Headers
$req.Content = [System.Net.Http.StringContent]::new($body, [System.Text.Encoding]::UTF8, 'application/json')

$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromMinutes(30)

$response = $client.SendAsync($req, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result
$stream = $response.Content.ReadAsStreamAsync().Result
$reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)

while (-not $reader.EndOfStream) {
  $line = $reader.ReadLine()
  if ($line) { Write-Host $line }
}