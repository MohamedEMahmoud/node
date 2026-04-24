# Socket.IO — توثيق التكامل (Web & Flutter)

توثيق محدث بناءً على الكود الحالي داخل `node/` وعلى الإعدادات الفعلية في `.env`.

**إصدار الخادم:** Socket.IO `4.x`.

---

## 1) عنوان الاتصال (Base URL)

يتم تحديد البروتوكول من `NODE_MODE` في `.env` داخل `node/app.js`:

- إذا `NODE_MODE=live` => الاتصال يكون `https://NODE_HOST:NODE_PORT`
- إذا `NODE_MODE` غير `live` => الاتصال يكون `http://NODE_HOST:NODE_PORT`

الإعدادات الحالية في `.env`:

- `NODE_MODE=live`
- `NODE_HOST=muqabalaapp.com`
- `NODE_PORT=4991`
- `APP_URL=https://muqabalaapp.com`

إذًا عنوان السوكِت الحالي:

- `https://muqabalaapp.com:4991`

**CORS:** السيرفر يسمح فقط بـ `origin: APP_URL` مع `credentials: true`.

---

## 2) Query Parameters الإلزامية عند الاتصال

الحقول المطلوبة من `socket/validation.js`:

- `userId` (رقم صحيح وغير 0)
- `userType` (string)
- `name` (string)
- `lang` (string مثل `ar` أو `en`)
- `deviceType` (string)
- `deviceId` (string)

> أي حقل ناقص يسبب `error-message` وقد يتم فصل الاتصال.

### `userType` المدعوم في المشروع

حسب `src/helper/morph.js` و `socket/helper.js`:

- `user`
- `admin`
- `provider`

---

## 3) الأحداث الفعلية من العميل إلى السيرفر

الأحداث الموجودة حاليًا في `socket/socket.js` فقط:

| الحدث | Payload | التحقق |
|------|---------|--------|
| `enter-chat` | `{ "room_id": <number|string number> }` | `room_id` رقم صالح |
| `send-message` | `{ "room_id": <number>, "type": "text" \| "image", "body": "<string>" }` | `room_id` + `type` + `body` |
| `exit-chat` | `{ "room_id": <number|string number> }` | `room_id` رقم صالح |

`send-message` object data (JavaScript):

```javascript
const sendMessageObjectData = {
  room_id: 4, // required, number
  type: "text", // required: text | image
  body: "مرحبا", // required, string
};
```

`send-message` object data (JSON):

```json
{
  "room_id": 4,
  "type": "text",
  "body": "مرحبا"
}
```

> لا توجد حاليًا أحداث مكالمات (`start-call` / `answer-call` / `reject-call` / `return-from-call`) في كود السوكِت الحالي.

---

## 4) الأحداث من السيرفر إلى العميل

### `message-received`

يتم إرسالها بعد حفظ الرسالة بنجاح داخل `socket/helper.js`.

شكل payload:

```json
{
  "id": 15,
  "sender_id": 20,
  "sender_type": "user",
  "sender_name": "Ali",
  "room_id": 4,
  "body": "مرحبا",
  "type": "text",
  "avatar": "",
  "is_sender": 1,
  "is_seen": 1,
  "created_at": "منذ لحظات",
  "updated_at": "2026-04-23T10:00:00.000Z"
}
```

`message-received` object data (JavaScript):

```javascript
const messageReceivedObjectData = {
  id: 15,
  sender_id: 20,
  sender_type: "user",
  sender_name: "Ali",
  room_id: 4,
  body: "مرحبا", // when type="image" this becomes full image URL
  type: "text", // text | image
  avatar: "",
  is_sender: 1, // 0 | 1
  is_seen: 1, // 0 | 1
  created_at: "منذ لحظات",
  updated_at: "2026-04-23T10:00:00.000Z",
};
```

ملاحظات:

- عند `type=image`، قيمة `body` تصبح رابطًا كاملاً من السيرفر بهذا الشكل:
  - `${APP_URL}/${STORAGE}/images/rooms/${room_id}/${fileName}/`
- `created_at` نص نسبي حسب `lang`.

### `error-message`

شكل payload:

```json
{
  "key": "fail",
  "message": "<translated-message>",
  "status": 400
}
```

أشهر المفاتيح المستخدمة:

- `userIdrequired`, `userTyperequired`, `namerequired`, `langrequired`, `deviceTyperequired`, `deviceIdrequired`
- `userIdRequired`
- `roomIdRequired`
- `invalidMessageType`
- `bodyRequired`
- `somethingWrong`

---

## 5) أمثلة تكامل

### JavaScript / TypeScript

```javascript
import { io } from "socket.io-client";

const socket = io("https://muqabalaapp.com:4991", {
  transports: ["websocket"],
  withCredentials: true,
  query: {
    userId: String(userId),
    userType: "user",
    name: displayName,
    lang: "ar",
    deviceType: "web",
    deviceId: deviceId,
  },
});

socket.on("message-received", (payload) => {
  // payload.type: text | image
});

socket.on("error-message", (error) => {
  // error.key, error.message, error.status
});

socket.emit("enter-chat", { room_id: roomId });
socket.emit("send-message", { room_id: roomId, type: "text", body: "مرحبا" });
socket.emit("exit-chat", { room_id: roomId });
```

### Flutter (Dart)

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io('https://muqabalaapp.com:4991', <String, dynamic>{
  'transports': ['websocket'],
  'query': <String, String>{
    'userId': userId.toString(),
    'userType': 'user',
    'name': displayName,
    'lang': 'ar',
    'deviceType': 'android',
    'deviceId': deviceId,
  },
});

socket.on('message-received', (data) {
  // text/image payload
});

socket.on('error-message', (data) {
  // key/message/status
});

socket.emit('enter-chat', {'room_id': roomId});
socket.emit('send-message', {
  'room_id': roomId,
  'type': 'text',
  'body': 'مرحبا',
});
socket.emit('exit-chat', {'room_id': roomId});
```

---

## 6) ملخص سريع

| العنصر | القيمة الحالية |
|------|------------------|
| البروتوكول | `https` (لأن `NODE_MODE=live`) |
| العنوان | `https://muqabalaapp.com:4991` |
| الأحداث من العميل | `enter-chat`, `send-message`, `exit-chat` |
| الأحداث من السيرفر | `message-received`, `error-message` |
| أنواع الرسائل المدعومة | `text`, `image` |
| `userType` المتوافق | `user`, `admin`, `provider`, `delegate` |
