export interface userDataIn {
    login: string,
    username: string,
    banner: string,
    avatar: string,
    status: string
}

export interface friendListIn {
    thereIsFriend: Boolean,
    listOfFriends: Array<string>,
}

export interface blockedListIn {
    thereIsBlocked: Boolean,
    listOfBlocked: Array<string>
}

export interface inventoryItem {
    id: number,
    rarity: number,
    category: string,
    name: string,
    description: string,
}

export interface statsIn {
    total: number,
    wins: number,
    looses: number,
    points: number,
    lastRival: string,
}

export interface formDataOut {
    username: string,
    avatar: string,
    banner: string
}

export interface onlineDataIn {
    info: {
        login: string,
        username: string,
        banner: string,
        avatar: string,
        stats: statsIn,
    }
    friend: boolean,
    friendLoading: boolean
    blockLoading: boolean
}

export interface match {
    rival: string,
    userPoints: number,
    rivalPoints: number,
    gameMode: string,
    key: number
}
