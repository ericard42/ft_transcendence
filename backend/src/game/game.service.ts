import {forwardRef, HttpException, HttpStatus, Inject, Injectable} from '@nestjs/common';
import {TmpDbService} from "../tmp_db/tmp_db.service";
import {UserService} from "../user/user.service";
import {EHistory, EStats, history, stats} from "./stats.interface";
import {InjectRepository} from "@nestjs/typeorm";
import {StatsEntity} from "../entities/stats.entity";
import {Repository} from "typeorm";

@Injectable()
export class GameService {
	constructor(private tmp_db: TmpDbService,
				@Inject(forwardRef(() => UserService))
				private userService: UserService,
				@InjectRepository(StatsEntity) private statsRepository: Repository<StatsEntity>) {}

	async verificationUsers(login: string, rival: string) {
		let user = await this.userService.getUser(login)
		if (!user)
			throw new HttpException('User not found', HttpStatus.NOT_FOUND)
		user = await this.userService.getUser(rival)
		if (!user)
			throw new HttpException('Rival not found', HttpStatus.NOT_FOUND)
		if (login === rival)
			throw new HttpException('User can\'t be Rival', HttpStatus.BAD_REQUEST)
	}

	async initStats(login: string) {
		const user = await this.userService.getUser(login)
		const stats = {
			id: user.id,
			total: 0,
			wins: 0,
			looses: 0,
			points: 5,
			lastRival: "No one :("
		}
		await this.statsRepository.save(stats)
	}

	async getStats(login: string) {
		const user = await this.userService.getUser(login)
		return await this.statsRepository.findOneBy({id: user.id})
	}

	async getWins(login: string) {
		const user = await this.userService.getUser(login)
		return {wins: (await this.statsRepository.findOneBy({id: user.id})).wins}
	}

	async getLooses(login: string) {
		const user = await this.userService.getUser(login)
		return {looses: (await this.statsRepository.findOneBy({id: user.id})).looses}
	}

	async getTotal(login: string) {
		const user = await this.userService.getUser(login)
		return {total: (await this.statsRepository.findOneBy({id: user.id})).total}
	}

	async getPoints(login: string) {
		const user = await this.userService.getUser(login)
		return {points: (await this.statsRepository.findOneBy({id: user.id})).points}
	}

	async getLastRival(login: string) {
		const user = await this.userService.getUser(login)
		return {lastRival: (await this.statsRepository.findOneBy({id: user.id})).lastRival}
	}

	async getHistory(login: string) {
		const user = await this.userService.getUser(login)
//		return {history: user.stats.history}
	}

	async fixPoints(login: string, points: number) {
		const user = await this.userService.getUser(login)
		if (points < 0)
			throw new HttpException('User can\'t have less of 0 point', HttpStatus.BAD_REQUEST)
		const stats = await this.statsRepository.findOneBy({id: user.id})
		stats.points = points
		await this.statsRepository.save(stats)
		return {points: stats.points}
	}

	async addHistory(login: string, rival: string,
			   points: number, rivalPoints: number,
			   mode: string) {
		await this.verificationUsers(login, rival)
		const user = await this.userService.getUser(login)
		const game = {
			login: login,
			rival: rival,
			userPoints: points,
			rivalPoints: rivalPoints,
			gameMode: mode,
		} as EHistory
		//user.stats.history = [game, ...user.stats.history]
		console.log(user)
		//let result: history[] = user.stats.history
		//result = [...result, game]
//		user.stats.history.push(game)
		return (this.addStats(login, points >= 5, rival))
	}

	async addStats(login: string, result: boolean, rival: string) {
		await this.verificationUsers(login, rival)
		const user = await this.userService.getUser(login);
		const stats = await this.statsRepository.findOneBy({id: user.id})
		console.log(result)
		if (result) {
			stats.wins++
			stats.points += 2
		}
		else {
			stats.looses++
			stats.points++
		}
		stats.total++
		stats.lastRival = rival

		return await this.statsRepository.save(stats)
	}
}
