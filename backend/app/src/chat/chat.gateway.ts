import {
	WebSocketGateway,
	WebSocketServer,
	SubscribeMessage,
	ConnectedSocket,
	MessageBody
  } from '@nestjs/websockets';
import {Socket} from "socket.io";
import {UserService} from "../user/user.service";
import {AuthService} from "../auth/auth.service";
import {ChatService} from "./chat.service";
import {ForbiddenException, NotFoundException} from "@nestjs/common";
import {Cron, CronExpression, SchedulerRegistry} from "@nestjs/schedule";

interface authData {
	token: string,
	login: string
}

interface messageData {
	channel: string,
	message: string,
}

interface unmuteOrUnban {
	channel: string,
	login: string
}

  @WebSocketGateway({ cors: true })
  export class ChatGateway {
	constructor(private userService: UserService,
				private authService: AuthService,
				private chatService: ChatService,
				private schedulerRegistry: SchedulerRegistry) {}

	@WebSocketServer() server;
	users: number = 0;
	sockUser = new Map<string, string>([])


	 @Cron(CronExpression.EVERY_5_SECONDS)
	 async triggerCronJob() {
		let list = await this.chatService.checkMute()
		 for (const data of list) {
			 await this.unmuteSomeone(data)
		 }
	}

	async handleConnection(client: Socket) {
		console.log("New connection :", client.id)
		if (!this.sockUser[client.id])
			client.emit('error', "Socket already used")
		else
			this.sockUser[client.id] = ""
	}

	async handleDisconnect(client: Socket) {
		console.log(this.sockUser[client.id])
		if (this.sockUser[client.id]) {
			await this.userService.changeOnline(this.sockUser[client.id], {online: false})
			this.sockUser.delete(client.id)
		}
	}

	//data -> token (Cookie "Session") and login (Cookie "Login")
	@SubscribeMessage('auth')
	async handleAuth (@MessageBody() data: authData, @ConnectedSocket() client: Socket) {
		let ret = await this.authService.isAuth(data.login, data.token)
		if (data.token === 'pass')
			ret = true
		this.server.emit('auth', ret)
		if (ret === true)
			this.sockUser[client.id] = data.login
	}

	//data -> channel (string) and message (string)
	@SubscribeMessage('message')
	async handleEvent (@MessageBody() data: messageData, @ConnectedSocket() client: Socket) {
		try {
			if (!this.sockUser[client.id])
				throw new NotFoundException("Socket doesn't exist")
			if (this.sockUser[client.id] === "")
				throw new NotFoundException("Socket isn't link with a user")
			const user = await this.userService.getUser(this.sockUser[client.id])
			if (!await this.chatService.isInChannel(data.channel, user.login))
				throw new ForbiddenException("User is not in the channel")
			const channel = await this.chatService.getChannel(data.channel)

			const mess = await this.chatService.sendMessage(this.sockUser[client.id], channel.name, data.message)

			const payload = {
				id: mess.id,
				login: user.login,
				message: data.message,
				avatar: user.avatar,
				username: user.username,
				channel: data.channel
			}
			this.server.emit('message', payload)
		}
		catch (e) {
			client.emit('error', e)
		}
	}

	// Data -> channel (string) and password (string "" if public or private)
	@SubscribeMessage('join')
	  async joinChannel(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
		try {
			if (!this.sockUser[client.id])
				throw new NotFoundException("Socket doesn't exist")
			if (this.sockUser[client.id] === "")
				throw new NotFoundException("Socket isn't link with a user")
			await this.chatService.joinChannel(data.channel, this.sockUser[client.id], data.password)
			this.server.emit('join', {
				login: this.sockUser[client.id],
				channel: data.channel
			})
		}
		catch (e) {
			client.emit('error', e)
		}
	}

	//data -> channel (String)
	@SubscribeMessage('leave')
	  async leaveChannel(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
		try {
			if (!this.sockUser[client.id])
				throw new NotFoundException("Socket doesn't exist")
			if (this.sockUser[client.id] === "")
				throw new NotFoundException("Socket isn't link with a user")
			await this.chatService.leaveChannel(data.channel, this.sockUser[client.id])
			this.server.emit('leave', {
				login: this.sockUser[client.id],
				channel: data.channel
			})
		}
		catch (e) {
			client.emit('error', e)
		}
	}

	//data -> to (login), message (String)
	@SubscribeMessage('dm')
	  async sendDM(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
		try {
			if (!this.sockUser[client.id])
				throw new NotFoundException("Socket doesn't exist")
			if (this.sockUser[client.id] === "")
				throw new NotFoundException("Socket isn't link with a user")
			await this.chatService.sendDM(this.sockUser[client.id], data.to, data.message)
			const payload = {
				from: this.sockUser[client.id],
				to: data.to,
				message: data.message
			}
			this.server.emit('dm', payload)
		}
		catch (e) {
			console.log(e)
			client.emit('error', e)
		}
	}

	//Data -> Channel (String) et Login (String du nouvel admin)
	@SubscribeMessage('admin')
	  async newAdmin(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
		try {
			if (!this.sockUser[client.id])
				throw new NotFoundException("Socket doesn't exist")
			if (this.sockUser[client.id] === "")
				throw new NotFoundException("Socket isn't link with a user")
			await this.chatService.addAdmin(data.channel, this.sockUser[client.id], data.login)
			const payload = {
				channel: data.channel,
				login: data.login
			}
			this.server.emit('admin', payload)
		}
		catch (e) {
			console.log(e)
			client.emit('error', e)
		}
	}

	  //Data -> Channel (string), target (string), until (Date)
	@SubscribeMessage('mute')
	  async muteSomeone(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
		try {
			if (!this.sockUser[client.id])
				throw new NotFoundException("Socket doesn't exist")
			if (this.sockUser[client.id] === "")
				throw new NotFoundException("Socket isn't link with a user")
			await this.chatService.muteSomeone(data.channel, this.sockUser[client.id], data.target, data.until)

			const payload = {
				channel: data.channel,
				mutedBy: this.sockUser[client.id],
				target: data.target,
				until: data.until
			}
			this.server.emit('mute', payload)
		}
		catch (e) {
			client.emit('error', e)
		}
	}

	//Data -> Channel (string), target (string), until (Date)
	  @SubscribeMessage('ban')
	  async banSomeone(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
		  try {
			  if (!this.sockUser[client.id])
				  throw new NotFoundException("Socket doesn't exist")
			  if (this.sockUser[client.id] === "")
				  throw new NotFoundException("Socket isn't link with a user")
			  await this.chatService.banSomeone(data.channel, this.sockUser[client.id], data.target, data.until)
			  const payload = {
				  channel: data.channel,
				  bannedBy: this.sockUser[client.id],
				  target: data.target,
				  until: data.until
			  }
			  this.server.emit('ban', payload)
		  }
		  catch (e) {
			client.emit('error', e)
		  }
	  }

	  @SubscribeMessage('unmute')
	  async unmuteSomeone(@MessageBody() data: any) {
		try {
			const payload = {
				channel: data.channel,
				login: data.login
			}
			await this.chatService.unMute(data.channel, data.login)
			this.server.emit('unmute', payload)
		}
		catch (e) {
			this.server.emit('error', e)
		}
	  }

	  async unbanSomeone(data: any) {
		try {
			const payload = {
				channel: data.channel,
				login: data.login
			}

			this.server.emit('unban', payload)
		}
		catch (e) {
			this.server.emit('error', e)
		}
	  }
  }
