import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Extract user_id from query string: ?user_id=123
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        self.user_id = query_params.get('user_id', ['anonymous'])[0]
        
        # In a real app, you might map users to specific rooms or just a global broadcast
        # For simplicity in testing if A can send to B, we'll put everyone in a "global" room
        self.room_group_name = "chat_global"

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']
        
        # Broadcast the message to the room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender': self.user_id
            }
        )

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']
        sender = event['sender']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'sender': sender
        }))
