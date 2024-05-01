import { FireStoreService } from "src/app/services/fire-store.service";
import { CategoryOption } from "../run/category";
import { Run } from "../run/run";
import { RunData } from "../run/run-data";
import { Timer } from "../run/timer";
import { DbLeaderboard } from "./db-leaderboard";
import { DbLeaderboardPb } from "./db-leaderboard-pb";
import { DbTeam } from "./db-team";
import { DbUsersCollection } from "./db-users-collection";
import { DbPb } from "./db-pb";
import { DbRecordingFile } from "./db-recording-file";
import { UserRecording } from "../recording/user-recording";
import { Observable, map } from "rxjs";
import { PbTeamPlayers } from "../peer/pb-team-players";

export class DbRun {
    data: RunData;
    teams: DbTeam[] = [];
    userIds: Map<string, boolean> | any = new Map();
    date: number;

    id?: string;
    dateFrontend?: Date;
    endTimeFrontend?: string;

    constructor() {
        this.id = crypto.randomUUID();
    }

    static convertToFromRun(run: Run): DbRun {
        let dbRun = new DbRun();

        dbRun.data = run.data;
        dbRun.date = run.timer.startDateMs ?? 0;

        //teams
        run.teams.forEach(team => {
            if (team.players.length !== 0) {
                dbRun.teams.push(new DbTeam(team));
                team.players.forEach(player => {
                    dbRun.userIds.set(player.user.id, true);
                });
            }
        });

        return dbRun;
    }


    userIdsToMap() {
        this.userIds = new Map(Object.entries(this.userIds));
    }

    fillFrontendValues(usersCollection: DbUsersCollection | undefined) {
        if (this.teams.length == 0 || !usersCollection) return;

        let lastTeamEndTime = this.teams.sort((a, b) => b.endTimeMs - a.endTimeMs)[0].endTimeMs;
        this.endTimeFrontend = lastTeamEndTime === 0 ? "DNF" : Timer.msToTextFormat(lastTeamEndTime);

        if (this.date)
            this.dateFrontend = new Date(this.date);

        this.teams.forEach((team, index) => {
            team.players.forEach((player, i) => {
                this.teams[index].players[i].currentUsernameFrontend = usersCollection?.users.find(x => x.id === player.user.id)?.name ?? player.user.name;
            });
        });

        return this;
    }

    clearFrontendValues() {
        this.endTimeFrontend = undefined;
        this.dateFrontend = undefined;
        this.teams.forEach((team, index) => {
            team.players.forEach((player, i) => {
                this.teams[index].players[i].currentUsernameFrontend = undefined;
            });
        });
    }


    checkUploadPbs(firestoreService: FireStoreService, signedInPlayerIds: string[], recordings: UserRecording[] | undefined): Observable<PbTeamPlayers[]> | undefined {
        if (this.data.category === CategoryOption.Custom) return;

        let leaderboards: DbLeaderboard[] = [];

        //fill leaderboards list
        let playerCounts: number[] = this.teams
            .filter(x => x.endTimeMs !== 0 && x.runIsValid)
            .flatMap(x => x.players.length)
            .filter((value, index, array) => array.indexOf(value) === index);
        
        if (playerCounts.length === 0) return;
        
        return firestoreService.getLeaderboards(this.data.category, this.data.requireSameLevel, playerCounts).pipe(
                map(dbLeaderboards => {
                    let pbUsers: PbTeamPlayers[] = [];
                    
                    if (!dbLeaderboards) return pbUsers;
                    leaderboards = dbLeaderboards;
        
                    playerCounts.forEach(count => {
                        let leaderboard = dbLeaderboards.find(x => x.players === count);
                        if (!leaderboard)
                            leaderboards.push(new DbLeaderboard(this.data.category, this.data.requireSameLevel, count));
                    });
        
                    
            
                    //fill leaderboards with pbs (filtered by valid and signed in)
                    for (let team of this.teams.filter(x => x.endTimeMs !== 0 && x.runIsValid && x.players.every(player => signedInPlayerIds.includes(player.user.id)))) {
                        let leaderboard = leaderboards.find(x => x.players === team.players.length);
                        if (!leaderboard) continue;
                        const leaderboardIndex = leaderboards.indexOf(leaderboard);
                        leaderboard = Object.assign(new DbLeaderboard(leaderboard.category, leaderboard.sameLevel, leaderboard.players), leaderboard);
            
                        const runnerIds = team.players.flatMap(x => x.user.id);
                        let previousPb = leaderboard.pbs.find(x => DbRun.arraysEqual(runnerIds, x.userIds));
                        
                        //if new pb
                        if (!previousPb || previousPb.endTimeMs > team.endTimeMs) {
                            leaderboard.pbs = leaderboard.pbs.sort((a, b) => a.endTimeMs - b.endTimeMs);
                            
                            let newPb = DbPb.convertToFromRun(this, team, leaderboard.pbs.length === 0 || leaderboard.pbs[0].endTimeMs > team.endTimeMs);
                            leaderboard.pbs.push(DbLeaderboardPb.convertToFromPb(newPb)); //needs to come before pb being added since it removes id
                            
                            if (!newPb.id) { //this should always be true
                                console.log("new pb id missing!");
                                newPb.id = crypto.randomUUID();
                            }
                            
                            //add users to new pbs map
                            let teamUserIds = team.players.flatMap(x => x.user.id);
                            pbUsers.push(new PbTeamPlayers(newPb.id, teamUserIds));
                            
        
                            //delete old recording if any
                            if (previousPb && previousPb.id && previousPb.playbackAvailable) {
                                const oldPbSubscription = firestoreService.getPb(previousPb.id).subscribe(oldDbPb => {
                                    oldPbSubscription.unsubscribe();
                                    if (oldDbPb) {
                                        oldDbPb.playbackAvailable = false;
                                        firestoreService.deleteRecording(oldDbPb.id);
                                        firestoreService.updatePb(oldDbPb);
                                    }
                                });
                            }
                            
                            //create and add recording to db
                            if (recordings && recordings.length !== 0) {
                                let userTeamRecordings: DbRecordingFile = new DbRecordingFile(newPb.version, recordings[0].gameVersion, recordings.filter(rec => teamUserIds.includes(rec.userId)) ?? [], newPb.id, this.data);
                                if (userTeamRecordings.recordings.length !== 0)
                                    firestoreService.uploadRecording(userTeamRecordings);
                            }
                                
        
                            //add pb to db
                            firestoreService.addPb(newPb);
                            if (previousPb)
                                leaderboard.pbs = leaderboard.pbs.filter(x => x.id !== previousPb!.id);
                            
                            //update leaderboard
                            const leaderboardId = leaderboard.id;
                            firestoreService.putLeaderboard(leaderboard);
                            leaderboard.id = leaderboardId; //id gets removed at upload this is a "quick fix" as it's needed for other teams
                            leaderboards[leaderboardIndex] = leaderboard; //needed as reference is probably lost when object is created anew
                        }
                    }
                    return pbUsers;
                })); 
    }

    //!TODO: Could be placed somewhere better
    static arraysEqual(array1: string[], array2: string[]): boolean {
        if (array1.length === array2.length)
            return array1.every(element => array2.includes(element));

        return false;
    }

}