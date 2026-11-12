import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface OcrProgressEvent {
  id: string;
  status: string;
  progressMessage: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ocr-progress',
})
export class OcrNotificationGateway {
  @WebSocketServer()
  server: Server;

  emitProgress(clientId: string, event: OcrProgressEvent): void {
    this.server.to(`client:${clientId}`).emit('ocr:progress', event);
    this.server.emit('ocr:progress', event);
  }

  handleConnection(client: any): void {
    const clientId = client.handshake?.query?.clientId;
    if (clientId) {
      client.join(`client:${clientId}`);
    }
  }
}
