# Socket.IO — Integration Reference

Complete documentation derived from the actual server source code in `node/` and the active `.env` configuration.

**Socket.IO Server Version:** `4.8.1`

---

## Table of Contents

1. [Connection URL & Configuration](#1-connection-url--configuration)
2. [Handshake Query Parameters](#2-handshake-query-parameters)
3. [Client → Server Events](#3-client--server-events)
4. [Server → Client Events](#4-server--client-events)
5. [Error Handling](#5-error-handling)
6. [Media File URL Pattern](#6-media-file-url-pattern)
7. [Call Flow Sequence](#7-call-flow-sequence)
8. [Location Tracking](#8-location-tracking)
9. [Integration Examples](#9-integration-examples)
   - [JavaScript / TypeScript (Web)](#91-javascript--typescript-web)
   - [Flutter (Dart)](#92-flutter-dart)
   - [iOS Native (Swift)](#93-ios-native-swift)
   - [Android Native (Kotlin)](#94-android-native-kotlin)
10. [Quick Reference](#10-quick-reference)

---

## 1) Connection URL & Configuration

### Protocol selection (`app.js`)

| `.env` value | Protocol | Server URL |
|---|---|---|
| `NODE_MODE=live` | **HTTPS** | `https://NODE_HOST:NODE_PORT` |
| `NODE_MODE` ≠ `live` | HTTP | `http://NODE_HOST:NODE_PORT` (development only) |

> **Production rule:** Always connect with **`https://`**. Never pass a raw `ws://` or `wss://` URL as the Socket.IO client base URL — pass the `https://` URL and let the library handle the transport upgrade.

### Active `.env` values

| Key | Value |
|---|---|
| `NODE_MODE` | `live` |
| `NODE_HOST` | `dashboard.practice.4hoste.com` |
| `NODE_PORT` | `4995` |
| `APP_URL` | `https://dashboard.practice.4hoste.com` |
| `STORAGE` | `storage` |
| `IMAGES` | `images` |
| `ROOMS` | `rooms` |
| `KEY` | `/var/cpanel/ssl/apache_tls/dashboard.practice.4hoste.com/combined` |
| `CERT` | `/var/cpanel/ssl/apache_tls/dashboard.practice.4hoste.com/certificates` |
| `CA` | `/var/cpanel/ssl/apache_tls/dashboard.practice.4hoste.com/combined` |

### Active Socket endpoint

```
https://dashboard.practice.4hoste.com:4995
```

### CORS

```
origin:      https://dashboard.practice.4hoste.com
methods:     GET, POST
credentials: true
```

- **Browser clients** must set `withCredentials: true` if using session-based auth.
- **Mobile native clients** (iOS / Android): the OS does not enforce browser-style CORS; connect to `https://HOST:PORT` with the same query parameters.

---

## 2) Handshake Query Parameters

All six fields are **required**. A missing or invalid field triggers an `error-message` event and the socket is **immediately disconnected**.

| Parameter | Type | Required | Validation |
|---|---|---|---|
| `userId` | `string` (numeric) | ✅ Yes | `Number(userId)` must be a non-zero integer |
| `userType` | `string` | ✅ Yes | See supported values below |
| `name` | `string` | ✅ Yes | Non-empty display name |
| `lang` | `string` | ✅ Yes | `ar` or `en` — controls error message language and `created_at` locale |
| `deviceType` | `string` | ✅ Yes | `web` · `ios` · `android` (or any non-empty string) |
| `deviceId` | `string` | ✅ Yes | Unique device / browser identifier or FCM/APNs token |

### Supported `userType` values

| `userType` | Laravel morph class | Full chat support |
|---|---|---|
| `user` | `App\Models\User` | ✅ Yes |
| `admin` | `App\Models\Admin` | ✅ Yes |
| `provider` | `App\Models\Provider` | ✅ Yes |
| `delegate` | `App\Models\Delegate` | ✅ Yes |

> Use one of the four values above for all chat flows. Other morph keys (`university`, `merchant`, etc.) exist in the DB layer but do not have a repository in the socket server and will cause failures on room-notification steps.

---

## 3) Client → Server Events

### 3.1 `enter-chat`

Join a chat room. Marks all unread messages in that room as seen for this user.

```json
{ "room_id": 4 }
```

| Field | Type | Required |
|---|---|---|
| `room_id` | `number` | ✅ Yes — valid integer |

---

### 3.2 `send-message`

Send a message to a chat room.

```json
{
  "room_id": 4,
  "type": "text",
  "body": "Hello!",
  "duration": 0
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `room_id` | `number` | ✅ Yes | Target room |
| `type` | `string` | ✅ Yes | One of: `text` · `image` · `sound` · `video` · `file` |
| `body` | `string` | ✅ Yes | Message text, or **filename only** for media types |
| `duration` | `number` | ✅ When `type=sound` | Audio duration in seconds |

#### `type` values

| `type` | `body` sent by client | `body` received from server |
|---|---|---|
| `text` | Plain text | Same text |
| `image` | Filename (e.g. `photo.jpg`) | Full URL |
| `sound` | Filename + `duration` required | Full URL |
| `video` | Filename | Full URL |
| `file` | Filename | Full URL |

> For media types, the client sends only the **filename** (after uploading via REST). The server builds and broadcasts the full URL in `message-received`.

---

### 3.3 `exit-chat`

Leave a chat room.

```json
{ "room_id": 4 }
```

| Field | Type | Required |
|---|---|---|
| `room_id` | `number` | ✅ Yes |

---

### 3.4 `addTracker`

Subscribe to real-time location updates for a delegate. Joins the internal room `delegate:{tracked_id}`.

```json
{ "tracked_id": 10 }
```

| Field | Type | Required |
|---|---|---|
| `tracked_id` | `number` | ✅ Yes — ID of the delegate to track |

---

### 3.5 `updateLocation`

Sent by a delegate to broadcast their GPS position. Persists to DB and emits `track-info` to all subscribers.

```json
{
  "lat": 24.7136,
  "lng": 46.6753
}
```

| Field | Type | Required |
|---|---|---|
| `lat` | `number` | ✅ Yes |
| `lng` | `number` | ✅ Yes |

---

### 3.6 `start-call`

Initiate a call. Broadcasts `message-received` with `type: "call"` to the entire room.

```json
{
  "room_id": 4,
  "shareLink": "https://meet.example.com/room/xyz"
}
```

| Field | Type | Required |
|---|---|---|
| `room_id` | `number` | ✅ Yes |
| `shareLink` | `string` | ✅ Yes — meeting/call URL shared with all room members |

---

### 3.7 `answer-call`

Accept a call. Broadcasts `message-received` with `type: "answer-call"` to the room.

```json
{ "room_id": 4 }
```

---

### 3.8 `reject-call`

Reject a call. Broadcasts `message-received` with `type: "call-rejected"` to the room.

```json
{ "room_id": 4 }
```

---

### 3.9 `return-from-call`

Signal that the call has ended. Broadcasts `message-received` with `type: "return-from-call"` to the room.

```json
{ "room_id": 4 }
```

---

## 4) Server → Client Events

### 4.1 `message-received`

The single broadcast event used for both **chat messages** and **call signals**. Distinguish by the `type` field.

#### Chat message payload (`type`: `text` · `image` · `sound` · `video` · `file`)

```json
{
  "id": 15,
  "sender_id": 20,
  "sender_type": "user",
  "sender_name": "Ali",
  "room_id": 4,
  "body": "Hello!",
  "type": "text",
  "duration": 0,
  "avatar": "",
  "is_sender": 1,
  "is_seen": 1,
  "created_at": "2026-04-23T10:00:00.000Z",
  "updated_at": "2026-04-23T10:00:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | Message ID in DB |
| `sender_id` | `number` | Sender's user ID |
| `sender_type` | `string` | `user` · `admin` · `provider` · `delegate` |
| `sender_name` | `string` | Display name |
| `room_id` | `number` | Chat room ID |
| `body` | `string` | For `text`: message text. For media types: full URL (built by server) |
| `type` | `string` | `text` · `image` · `sound` · `video` · `file` |
| `duration` | `number` | Audio seconds. `0` for non-sound types |
| `avatar` | `string` | Sender avatar URL or empty string |
| `is_sender` | `0 \| 1` | `1` = you sent this message |
| `is_seen` | `0 \| 1` | `1` = message was seen at delivery time |
| `created_at` | `string` | Relative time string in the `lang` locale (moment.js `fromNow`) |
| `updated_at` | `string` | ISO 8601 timestamp |

#### Call signal payloads

All call signals arrive on the same `message-received` event. Check `type`:

| `type` | Trigger event | Extra fields |
|---|---|---|
| `"call"` | `start-call` | `room_id` (string), `shareLink` |
| `"answer-call"` | `answer-call` | `room_id` (string) |
| `"call-rejected"` | `reject-call` | `room_id` (string) |
| `"return-from-call"` | `return-from-call` | `room_id` (string) |

> ⚠️ **`room_id` type caveat:** In call payloads `room_id` arrives as a **string** (e.g. `"4"`). In normal message payloads it arrives as a **number**. Parse defensively on all platforms.

Call signal example:

```json
{
  "room_id": "4",
  "type": "call",
  "shareLink": "https://meet.example.com/room/xyz"
}
```

---

### 4.2 `track-info`

Emitted to all clients subscribed to `delegate:{tracked_id}` whenever the delegate calls `updateLocation`.

```json
{
  "lat": 24.7136,
  "lng": 46.6753,
  "user_id": 10
}
```

| Field | Type | Notes |
|---|---|---|
| `lat` | `number` | Delegate latitude |
| `lng` | `number` | Delegate longitude |
| `user_id` | `number` | The delegate's user ID |

---

### 4.3 `error-message`

Emitted to the sender socket when validation fails or an exception occurs.

```json
{
  "key": "fail",
  "message": "wrong in the Room_id",
  "status": 400
}
```

| Field | Type | Notes |
|---|---|---|
| `key` | `string` | `"fail"` for validation errors · `"exception"` for server exceptions |
| `message` | `string` | Human-readable, localised by `lang` query parameter |
| `status` | `number` | Always `400` |

---

## 5) Error Handling

### Validation error keys

| Phrase key | Trigger |
|---|---|
| `userIdrequired` | `userId` missing in query |
| `userTyperequired` | `userType` missing in query |
| `namerequired` | `name` missing in query |
| `langrequired` | `lang` missing in query |
| `deviceTyperequired` | `deviceType` missing in query |
| `deviceIdrequired` | `deviceId` missing in query |
| `userIdRequired` | `userId` is `0` or non-numeric |
| `roomIdRequired` | `room_id` missing or non-numeric |
| `invalidMessageType` | `type` not in `['text','image','sound','video','file']` |
| `bodyRequired` | `body` missing or not a string |
| `durationRequired` | `type=sound` but `duration` missing or invalid |
| `mustNumber` | A numeric field received a non-numeric value |
| `somethingWrong` | Unhandled server exception |

> Any query-parameter error (`userId`, `userType`, `name`, `lang`, `deviceType`, `deviceId`) also **disconnects** the socket immediately after the error event.

### Connection lifecycle

| Event | Meaning | Recommended action |
|---|---|---|
| `connect` | Session ready | Now safe to `emit('enter-chat', ...)` |
| `connect_error` | Connection failed | Log reason; retry with exponential back-off |
| `disconnect` | Session closed | Re-join rooms via `enter-chat` on reconnect |
| `error-message` | Server validation / exception | Show `message` to user; check `key` for logic |

---

## 6) Media File URL Pattern

For `image`, `sound`, `video`, and `file` message types, the server broadcasts the **full URL** in the `body` field of `message-received`.

Built by `src/helper/return-object.js` using only `APP_URL` and `STORAGE` from `.env`:

```
{APP_URL}/{STORAGE}/images/rooms/{room_id}/{body}/
```

With active `.env` values:

```
https://dashboard.practice.4hoste.com/storage/images/rooms/{room_id}/{filename}/
```

Example:

```
https://dashboard.practice.4hoste.com/storage/images/rooms/4/1714000000000-photo.jpg/
```

> When **sending** a message, the client sends only the **filename** in `body`. The full URL is returned only in the server broadcast.

---

## 7) Call Flow Sequence

```
A (caller)                     Server                     B (callee)
    │                             │                            │
    │── start-call ──────────────>│                            │
    │   { room_id, shareLink }    │── message-received ───────>│
    │                             │   { type:"call",           │
    │                             │     room_id, shareLink }   │
    │                             │                            │
    │                             │<── answer-call ────────────│
    │                             │    { room_id }             │
    │<── message-received ────────│                            │
    │    { type:"answer-call",    │                            │
    │      room_id }              │                            │
    │                             │                            │
    │── return-from-call ────────>│                            │
    │   { room_id }               │── message-received ───────>│
    │                             │   { type:"return-from-call"│
    │                             │     room_id }              │
```

> `reject-call` follows the same pattern as `answer-call` but broadcasts `type: "call-rejected"`.

---

## 8) Location Tracking

```
Tracker client                  Server                  Delegate client
      │                           │                           │
      │── addTracker ────────────>│                           │
      │   { tracked_id: 10 }      │ joins room delegate:10    │
      │                           │                           │
      │                           │<── updateLocation ────────│
      │                           │    { lat, lng }           │
      │<── track-info ────────────│                           │
      │   { lat, lng, user_id }   │ DB updated                │
```

---

## 9) Integration Examples

### 9.1 JavaScript / TypeScript (Web)

```typescript
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://dashboard.practice.4hoste.com:4995";

const socket: Socket = io(SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
  query: {
    userId:     String(userId),    // e.g. "42"
    userType:   "user",            // user | admin | provider | delegate
    name:       displayName,       // e.g. "Ali Ahmed"
    lang:       "ar",              // ar | en
    deviceType: "web",
    deviceId:   deviceId,          // unique browser/device ID
  },
});

// ── Connection lifecycle ──────────────────────────────────────
socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

// ── Incoming message or call signal ──────────────────────────
socket.on("message-received", (payload) => {
  switch (payload.type) {
    case "text":
    case "image":
    case "sound":
    case "video":
    case "file":
      // payload.body = text OR full media URL (server-built)
      break;
    case "call":
      // payload.shareLink = call URL
      break;
    case "answer-call":
      break;
    case "call-rejected":
      break;
    case "return-from-call":
      break;
  }
});

// ── Location tracking ─────────────────────────────────────────
socket.on("track-info", (data: { lat: number; lng: number; user_id: number }) => {
  console.log("Location:", data.lat, data.lng, "user:", data.user_id);
});

// ── Error ─────────────────────────────────────────────────────
socket.on("error-message", (error: { key: string; message: string; status: number }) => {
  console.error(`[${error.key}] ${error.message}`);
});

// ── Chat ─────────────────────────────────────────────────────
socket.emit("enter-chat",   { room_id: 4 });
socket.emit("send-message", { room_id: 4, type: "text",  body: "Hello!" });
socket.emit("send-message", { room_id: 4, type: "sound", body: "audio.mp3", duration: 12 });
socket.emit("exit-chat",    { room_id: 4 });

// ── Calls ─────────────────────────────────────────────────────
socket.emit("start-call",       { room_id: 4, shareLink: "https://meet.example.com/xyz" });
socket.emit("answer-call",      { room_id: 4 });
socket.emit("reject-call",      { room_id: 4 });
socket.emit("return-from-call", { room_id: 4 });

// ── Location ─────────────────────────────────────────────────
socket.emit("addTracker",     { tracked_id: 10 });
socket.emit("updateLocation", { lat: 24.7136, lng: 46.6753 });
```

---

### 9.2 Flutter (Dart)

Add to `pubspec.yaml`:

```yaml
dependencies:
  socket_io_client: ^2.0.3+1
```

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

const String socketUrl = 'https://dashboard.practice.4hoste.com:4995';

IO.Socket socket = IO.io(
  socketUrl,
  IO.OptionBuilder()
    .setTransports(['websocket'])
    .enableForceNew()
    .enableForceNewConnection()
    .setQuery({
      'userId':     userId.toString(),
      'userType':   'user',            // user | admin | provider | delegate
      'name':       displayName,
      'lang':       'ar',              // ar | en
      'deviceType': 'android',         // android | ios | web
      'deviceId':   deviceId,
    })
    .build(),
);

// ── Connection lifecycle ──────────────────────────────────────
socket.onConnect((_) => print('Connected: \${socket.id}'));
socket.onConnectError((err) => print('Connect error: \$err'));
socket.onDisconnect((_) => print('Disconnected'));

// ── Incoming message or call signal ──────────────────────────
socket.on('message-received', (data) {
  final type = data['type'] as String? ?? '';
  if (['text', 'image', 'sound', 'video', 'file'].contains(type)) {
    // data['body'] = text or full media URL
    print('Message (\$type): \${data['body']}');
  } else if (type == 'call') {
    print('Incoming call: \${data['shareLink']}');
  } else if (type == 'answer-call') {
    print('Call answered');
  } else if (type == 'call-rejected') {
    print('Call rejected');
  } else if (type == 'return-from-call') {
    print('Returned from call');
  }
  // NOTE: room_id arrives as String in call payloads — parse defensively
  final roomId = int.tryParse(data['room_id'].toString()) ?? 0;
});

// ── Location tracking ─────────────────────────────────────────
socket.on('track-info', (data) {
  final lat    = (data['lat']     as num).toDouble();
  final lng    = (data['lng']     as num).toDouble();
  final userId = data['user_id']  as int;
  print('Location: \$lat, \$lng (user \$userId)');
});

// ── Error ─────────────────────────────────────────────────────
socket.on('error-message', (data) {
  print('Error [\${data['key']}]: \${data['message']}');
});

// ── Chat ─────────────────────────────────────────────────────
socket.emit('enter-chat',   {'room_id': 4});
socket.emit('send-message', {'room_id': 4, 'type': 'text',  'body': 'Hello!'});
socket.emit('send-message', {'room_id': 4, 'type': 'sound', 'body': 'audio.mp3', 'duration': 12});
socket.emit('exit-chat',    {'room_id': 4});

// ── Calls ─────────────────────────────────────────────────────
socket.emit('start-call',       {'room_id': 4, 'shareLink': 'https://meet.example.com/xyz'});
socket.emit('answer-call',      {'room_id': 4});
socket.emit('reject-call',      {'room_id': 4});
socket.emit('return-from-call', {'room_id': 4});

// ── Location ─────────────────────────────────────────────────
socket.emit('addTracker',     {'tracked_id': 10});
socket.emit('updateLocation', {'lat': 24.7136, 'lng': 46.6753});
```

---

### 9.3 iOS Native (Swift)

Add via SPM:

```
https://github.com/socketio/socket.io-client-swift  (~16.x)
```

```swift
import SocketIO

let manager = SocketManager(
    socketURL: URL(string: "https://dashboard.practice.4hoste.com:4995")!,
    config: [
        .log(false),
        .compress,
        .connectParams([
            "userId":     String(userId),
            "userType":   "user",          // user | admin | provider | delegate
            "name":       displayName,
            "lang":       "ar",            // ar | en
            "deviceType": "ios",
            "deviceId":   deviceId,
        ]),
        .secure(true),
        .selfSigned(false),
    ]
)

let socket = manager.defaultSocket

// ── Connection lifecycle ──────────────────────────────────────
socket.on(clientEvent: .connect) { _, _ in
    print("Connected: \(socket.sid ?? "")")
}

socket.on(clientEvent: .error) { data, _ in
    print("Connect error: \(data)")
}

socket.on(clientEvent: .disconnect) { _, _ in
    print("Disconnected")
}

// ── Incoming message or call signal ──────────────────────────
socket.on("message-received") { data, _ in
    guard let payload = data[0] as? [String: Any],
          let type    = payload["type"] as? String else { return }

    switch type {
    case "text", "image", "sound", "video", "file":
        let body = payload["body"] as? String ?? ""
        print("Message (\(type)): \(body)")
    case "call":
        let link = payload["shareLink"] as? String ?? ""
        print("Incoming call: \(link)")
    case "answer-call":
        print("Call answered")
    case "call-rejected":
        print("Call rejected")
    case "return-from-call":
        print("Returned from call")
    default:
        break
    }
    // room_id may arrive as String in call payloads
    let roomId = Int("\(payload["room_id"] ?? 0)") ?? 0
}

// ── Location tracking ─────────────────────────────────────────
socket.on("track-info") { data, _ in
    guard let payload = data[0] as? [String: Any] else { return }
    let lat    = payload["lat"]     as? Double ?? 0
    let lng    = payload["lng"]     as? Double ?? 0
    let userId = payload["user_id"] as? Int    ?? 0
    print("Location: \(lat), \(lng) (user \(userId))")
}

// ── Error ─────────────────────────────────────────────────────
socket.on("error-message") { data, _ in
    guard let payload = data[0] as? [String: Any] else { return }
    let key     = payload["key"]     as? String ?? ""
    let message = payload["message"] as? String ?? ""
    print("Error [\(key)]: \(message)")
}

socket.connect()

// ── Chat ─────────────────────────────────────────────────────
socket.emit("enter-chat",   ["room_id": 4])
socket.emit("send-message", ["room_id": 4, "type": "text",  "body": "Hello!"])
socket.emit("send-message", ["room_id": 4, "type": "sound", "body": "audio.mp3", "duration": 12])
socket.emit("exit-chat",    ["room_id": 4])

// ── Calls ─────────────────────────────────────────────────────
socket.emit("start-call",       ["room_id": 4, "shareLink": "https://meet.example.com/xyz"])
socket.emit("answer-call",      ["room_id": 4])
socket.emit("reject-call",      ["room_id": 4])
socket.emit("return-from-call", ["room_id": 4])

// ── Location ─────────────────────────────────────────────────
socket.emit("addTracker",     ["tracked_id": 10])
socket.emit("updateLocation", ["lat": 24.7136, "lng": 46.6753])
```

---

### 9.4 Android Native (Kotlin)

Add to `build.gradle`:

```groovy
implementation("io.socket:socket.io-client:2.1.0")
```

```kotlin
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

val options = IO.Options.builder()
    .setTransports(arrayOf("websocket"))
    .setQuery(
        "userId=$userId" +
        "&userType=user" +           // user | admin | provider | delegate
        "&name=${displayName}" +
        "&lang=ar" +                 // ar | en
        "&deviceType=android" +
        "&deviceId=$deviceId"
    )
    .setSecure(true)                 // required — server is HTTPS
    .build()

val socket: Socket = IO.socket(
    URI.create("https://dashboard.practice.4hoste.com:4995"),
    options
)

// ── Connection lifecycle ──────────────────────────────────────
socket.on(Socket.EVENT_CONNECT) {
    println("Connected: ${socket.id()}")
}

socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
    println("Connect error: ${args[0]}")
}

socket.on(Socket.EVENT_DISCONNECT) {
    println("Disconnected")
}

// ── Incoming message or call signal ──────────────────────────
socket.on("message-received") { args ->
    val payload = args[0] as JSONObject
    when (val type = payload.optString("type")) {
        "text", "image", "sound", "video", "file" -> {
            println("Message ($type): ${payload.optString("body")}")
        }
        "call" -> {
            println("Incoming call: ${payload.optString("shareLink")}")
        }
        "answer-call"      -> println("Call answered")
        "call-rejected"    -> println("Call rejected")
        "return-from-call" -> println("Returned from call")
    }
    // room_id may arrive as String in call payloads — parse defensively
    val roomId = payload.opt("room_id").toString().toIntOrNull() ?: 0
}

// ── Location tracking ─────────────────────────────────────────
socket.on("track-info") { args ->
    val data   = args[0] as JSONObject
    val lat    = data.optDouble("lat")
    val lng    = data.optDouble("lng")
    val userId = data.optInt("user_id")
    println("Location: $lat, $lng (user $userId)")
}

// ── Error ─────────────────────────────────────────────────────
socket.on("error-message") { args ->
    val error   = args[0] as JSONObject
    val key     = error.optString("key")
    val message = error.optString("message")
    println("Error [$key]: $message")
}

socket.connect()

// ── Chat ─────────────────────────────────────────────────────
socket.emit("enter-chat",   JSONObject().put("room_id", 4))
socket.emit("send-message", JSONObject().put("room_id", 4).put("type", "text").put("body", "Hello!"))
socket.emit("send-message", JSONObject().put("room_id", 4).put("type", "sound").put("body", "audio.mp3").put("duration", 12))
socket.emit("exit-chat",    JSONObject().put("room_id", 4))

// ── Calls ─────────────────────────────────────────────────────
socket.emit("start-call",       JSONObject().put("room_id", 4).put("shareLink", "https://meet.example.com/xyz"))
socket.emit("answer-call",      JSONObject().put("room_id", 4))
socket.emit("reject-call",      JSONObject().put("room_id", 4))
socket.emit("return-from-call", JSONObject().put("room_id", 4))

// ── Location ─────────────────────────────────────────────────
socket.emit("addTracker",     JSONObject().put("tracked_id", 10))
socket.emit("updateLocation", JSONObject().put("lat", 24.7136).put("lng", 46.6753))
```

---

## 10) Quick Reference

### Connection

| Item | Value |
|---|---|
| Endpoint | `https://dashboard.practice.4hoste.com:4995` |
| Protocol | HTTPS (`NODE_MODE=live`) |
| Socket.IO version | `4.8.1` |
| CORS origin | `https://dashboard.practice.4hoste.com` |
| Transport | `websocket` |

### Client → Server events

| Event | Required payload fields | Description |
|---|---|---|
| `enter-chat` | `room_id` | Join room, mark messages seen |
| `send-message` | `room_id`, `type`, `body` [, `duration`] | Send a message |
| `exit-chat` | `room_id` | Leave room |
| `addTracker` | `tracked_id` | Subscribe to delegate GPS |
| `updateLocation` | `lat`, `lng` | Broadcast own GPS (delegate only) |
| `start-call` | `room_id`, `shareLink` | Initiate a call |
| `answer-call` | `room_id` | Accept a call |
| `reject-call` | `room_id` | Decline a call |
| `return-from-call` | `room_id` | End / leave a call |

### Server → Client events

| Event | When | Key fields |
|---|---|---|
| `message-received` | New message saved or call signal | `type`, `body`, `sender_id`, `room_id`, … |
| `track-info` | Delegate calls `updateLocation` | `lat`, `lng`, `user_id` |
| `error-message` | Validation failure or server exception | `key`, `message`, `status` |

### `message-received` — `type` values

| `type` | Origin | `body` |
|---|---|---|
| `text` | `send-message` | Message text |
| `image` | `send-message` | Full URL to image |
| `sound` | `send-message` | Full URL to audio |
| `video` | `send-message` | Full URL to video |
| `file` | `send-message` | Full URL to file |
| `call` | `start-call` | — (see `shareLink`) |
| `answer-call` | `answer-call` | — |
| `call-rejected` | `reject-call` | — |
| `return-from-call` | `return-from-call` | — |