# ==========================================
# ANTI ARCADE LAN SERVER (ไม่ต้องใช้สิทธิ์ Admin, รองรับทุกเครื่องในวง LAN)
# ==========================================

$Port = 8080
$RootDir = $PSScriptRoot
if (-not $RootDir) { $RootDir = (Get-Location).Path }
$DbFile = Join-Path $RootDir "lan_users_db.json"

if (-not (Test-Path $DbFile)) {
    "[]" | Set-Content -Path $DbFile -Encoding UTF8
}

# ค้นหา IP Address ของวง LAN (Wi-Fi / Ethernet)
$LanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.'
} | Select-Object -First 1).IPAddress

if (-not $LanIp) { $LanIp = "localhost" }

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

public class SimpleLanServer {
    private TcpListener listener;
    private string rootDir;
    private string dbFile;
    private string lanIp;
    private int port;
    private object dbLock = new object();

    public SimpleLanServer(string rootDir, string dbFile, string lanIp, int port) {
        this.rootDir = rootDir;
        this.dbFile = dbFile;
        this.lanIp = lanIp;
        this.port = port;
    }

    public void Start() {
        listener = new TcpListener(IPAddress.Any, port);
        listener.Start();
        while (true) {
            try {
                TcpClient client = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(HandleClient, client);
            } catch {
                break;
            }
        }
    }

    private void HandleClient(object obj) {
        using (TcpClient client = (TcpClient)obj)
        using (NetworkStream stream = client.GetStream()) {
            try {
                stream.ReadTimeout = 5000;
                stream.WriteTimeout = 5000;

                byte[] buffer = new byte[65536];
                int bytesRead = stream.Read(buffer, 0, buffer.Length);
                if (bytesRead <= 0) return;

                string rawReq = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                string[] lines = rawReq.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                if (lines.Length == 0) return;

                string[] reqParts = lines[0].Split(' ');
                if (reqParts.Length < 2) return;

                string method = reqParts[0].ToUpperInvariant();
                string urlPath = reqParts[1].Split('?')[0];

                // แยก Body ของ HTTP Request
                int bodyIdx = rawReq.IndexOf("\r\n\r\n");
                string body = bodyIdx >= 0 ? rawReq.Substring(bodyIdx + 4) : "";

                if (urlPath == "/api/users" && method == "GET") {
                    string usersJson = "[]";
                    lock (dbLock) {
                        if (File.Exists(dbFile)) {
                            usersJson = File.ReadAllText(dbFile, Encoding.UTF8).Trim();
                            if (string.IsNullOrEmpty(usersJson)) usersJson = "[]";
                        }
                    }
                    string payload = "{\"lanIp\":\"" + lanIp + "\",\"port\":" + port + ",\"users\":" + usersJson + "}";
                    SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(payload));
                    return;
                }

                if (urlPath == "/api/sync" && method == "POST") {
                    // ดึง array หลัง "users":
                    int uIdx = body.IndexOf("\"users\":");
                    if (uIdx >= 0) {
                        int startArr = body.IndexOf('[', uIdx);
                        int endArr = body.LastIndexOf(']');
                        if (startArr >= 0 && endArr > startArr) {
                            string incomingArray = body.Substring(startArr, endArr - startArr + 1);
                            lock (dbLock) {
                                File.WriteAllText(dbFile, incomingArray, Encoding.UTF8);
                            }
                        }
                    }
                    string currentJson = "[]";
                    lock (dbLock) {
                        if (File.Exists(dbFile)) currentJson = File.ReadAllText(dbFile, Encoding.UTF8).Trim();
                    }
                    string resp = "{\"ok\":true,\"users\":" + currentJson + "}";
                    SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(resp));
                    return;
                }

                if (urlPath == "/" || string.IsNullOrEmpty(urlPath)) {
                    urlPath = "/index.html";
                }

                string cleanRel = urlPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                if (cleanRel.Contains("..")) {
                    SendResponse(stream, "403 Forbidden", "text/plain", Encoding.UTF8.GetBytes("Forbidden"));
                    return;
                }

                string fullPath = Path.Combine(rootDir, cleanRel);
                if (!File.Exists(fullPath)) {
                    SendResponse(stream, "404 Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("404 Not Found"));
                    return;
                }

                string ext = Path.GetExtension(fullPath).ToLowerInvariant();
                string mime = "application/octet-stream";
                if (ext == ".html") mime = "text/html; charset=utf-8";
                else if (ext == ".css") mime = "text/css; charset=utf-8";
                else if (ext == ".js") mime = "application/javascript; charset=utf-8";
                else if (ext == ".json") mime = "application/json; charset=utf-8";
                else if (ext == ".png") mime = "image/png";
                else if (ext == ".jpg" || ext == ".jpeg") mime = "image/jpeg";
                else if (ext == ".svg") mime = "image/svg+xml";

                byte[] fileBytes = File.ReadAllBytes(fullPath);
                SendResponse(stream, "200 OK", mime, fileBytes);
            } catch {
            }
        }
    }

    private void SendResponse(NetworkStream stream, string status, string contentType, byte[] bodyBytes) {
        StringBuilder sb = new StringBuilder();
        sb.Append("HTTP/1.1 " + status + "\r\n");
        sb.Append("Content-Type: " + contentType + "\r\n");
        sb.Append("Content-Length: " + bodyBytes.Length + "\r\n");
        sb.Append("Access-Control-Allow-Origin: *\r\n");
        sb.Append("Cache-Control: no-cache\r\n");
        sb.Append("Connection: close\r\n\r\n");

        byte[] headerBytes = Encoding.UTF8.GetBytes(sb.ToString());
        stream.Write(headerBytes, 0, headerBytes.Length);
        stream.Write(bodyBytes, 0, bodyBytes.Length);
        stream.Flush();
    }
}
"@

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   🕹️  ANTI ARCADE LAN SERVER IS RUNNING!  🕹️" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "▶ เล่นที่เครื่องนี้ เปิดเบราว์เซอร์ไปที่: " -NoNewline
Write-Host "http://localhost:$Port" -ForegroundColor Yellow
Write-Host "▶ เครื่องอื่นในวง LAN / Wi-Fi เดียวกัน เข้าที่: " -NoNewline
Write-Host "http://${LanIp}:$Port" -ForegroundColor Magenta
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "(กด Ctrl + C หรือปิดหน้าต่างนี้เมื่อต้องการหยุดเซิร์ฟเวอร์)" -ForegroundColor Gray

$server = New-Object SimpleLanServer($RootDir, $DbFile, $LanIp, $Port)
$server.Start()
