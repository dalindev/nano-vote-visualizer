import BigNumber from 'bignumber.js'
import { tools } from 'nanocurrency-web';
import { Observable, Subject } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';

import { HttpClient } from '@angular/common/http';
import { Injectable } from "@angular/core";

@Injectable()
export class NanoWebsocketService {

	wsUrl = 'wss://nanows.numsu.dev';
	rpcUrl = 'https://nanoproxy.numsu.dev/proxy';

	principals: Principal[] = [];
	principalWeights = new Map<string, number>();
	quorumPercent: number;
	onlineStake: number;

	voteSubscription = new Subject<Vote>();
	confirmationSubscription = new Subject<Confirmation>();
	stopppedElectionsSubscription = new Subject<StoppedElection>();

	constructor(private http: HttpClient) {
	}

	async subscribe(): Promise<Subscriptions> {
		const socket = webSocket<any>(this.wsUrl);

		socket.asObservable().subscribe(res => {
			switch (res.topic) {
				case 'vote':
					this.voteSubscription.next(res);
					break;
				case 'confirmation':
					this.confirmationSubscription.next(res);
					break;
				case 'stopped_election':
					this.stopppedElectionsSubscription.next(res);
					break;
				default:
					break;
			}
		});

		socket.next({
			'action': 'subscribe',
			'topic': 'vote',
			'options': {
				'representatives': this.principals.map(p => p.account),
			},
		});
		socket.next({
			'action': 'subscribe',
			'topic': 'confirmation',
			'options': {
				'confirmation_type': 'active',
				'include_election_info': 'false',
				'include_block': 'false',
			},
		});
		socket.next({
			'action': 'subscribe',
			'topic': 'stopped_election',
		});

		return {
			votes: this.voteSubscription,
			confirmations: this.confirmationSubscription,
			stoppedElections: this.stopppedElectionsSubscription,
		};
	}

	async updatePrincipalsAndQuorum() {
		this.principals = await this.http.get<Principal[]>('https://mynano.ninja/api/accounts/principals').toPromise();
		this.principals.forEach(p => this.principalWeights.set(p.account, new BigNumber(p.votingweight).shiftedBy(-30).toNumber()));

		const quorumResponse = await this.http.post<ConfirmationQuorumResponse>(this.rpcUrl, {
			'action': 'confirmation_quorum'
		}).toPromise();

		this.quorumPercent = new BigNumber(tools.convert(quorumResponse.online_weight_quorum_percent, 'RAW', 'NANO')).toNumber();
		this.onlineStake = new BigNumber(tools.convert(quorumResponse.online_stake_total, 'RAW', 'NANO')).toNumber();
	}

}

export interface Subscriptions {
	votes: Subject<Vote>;
	confirmations: Subject<Confirmation>;
	stoppedElections: Subject<StoppedElection>;
}

export interface Principal {
	account: string;
	alias: string;
	delegators: number;
	uptime: number;
	votelatency: number;
	votingweight: number;
}

export interface Vote extends ResponseBase {
	message: VoteMessage;
}

export interface VoteMessage {
	account: string;
	signature: string;
	sequence: string;
	blocks: string[];
	type: string;
}

export interface Confirmation extends ResponseBase {
	message: ConfirmationMessage;
}

export interface ConfirmationMessage {
	account: string;
	amount: string;
	hash: string;
	confirmation_type: string;
}

export interface StoppedElection extends ResponseBase {
	message: StoppedElectionHash;
}

export interface StoppedElectionHash {
	hash: string;
}

export interface ResponseBase {
	topic: string;
	time: string;
}

export interface ConfirmationQuorumResponse {
	quorum_delta: string;
	online_weight_quorum_percent: string;
	online_weight_minimum: string;
	online_stake_total: string;
	peers_stake_total: string;
	trended_stake_total: string;
}