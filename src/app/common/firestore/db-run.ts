import { Task } from "../opengoal/task";
import { Run } from "../run/run";
import { RunData } from "../run/run-data";
import { DbTeam } from "./db-team";
import { DbUsersCollection } from "./db-users-collection";

export class DbRun {
    data: RunData;
    teams: DbTeam[] = [];
    playerIds: string[] = [];
    date: number | null;
    playback: any;

    id?: string;
    dateFrontend?: Date;
    endTimeFrontend?: string;

    constructor() {

    }

    static convertToFromRun(run: Run): DbRun {
        let dbRun = new DbRun();
        
        dbRun.data = run.data;
        dbRun.date = run.timer.startDateMs;

        //teams
        run.teams.forEach((team, index) => {
            //this.convertOldRun1(run, team, index);
            if (team?.tasks && team.tasks.length !== 0) {
                let teamEndTask = team.tasks[0];
                run.teams[index].endTime = teamEndTask.gameTask !== Task.forfeit ? teamEndTask.obtainedAt : "DNF";
            }
            dbRun.teams.push(new DbTeam(team));
        });
        
        //this.convertOldRun2(run);
        return dbRun;
    }



    fillFrontendValues(usersCollection: DbUsersCollection, playerId: string = "") {
        let playerTeam = this.teams.find(team => team.players.some(x => x.user.id === playerId));
        if (playerTeam)
            this.endTimeFrontend = playerTeam.endTime;
        else
            this.endTimeFrontend = this.teams.find(x => x.endTime !== "DNF")?.endTime ?? "DNF";
        
        if (this.date)
            this.dateFrontend = new Date(this.date);
        
        this.teams.forEach((team, index) => {
            team.players.forEach((player, i) => {
                this.teams[index].players[i].currentUsernameFrontend = usersCollection?.users.find(x => x.id === player.user.id)?.name ?? player.user.name;
            });
        });


        this.teams.forEach((team, index) => {
            this.teams[index].players = team.players.sort((x, y) => y.cellsCollected - x.cellsCollected);
        });

        return this;
    }



    /*
    convertOldRun1(run: Run, team: Team, index: number) {
        team.cellCount = 0;
        
        team.players.forEach((player, ind) => {
            let name = player.name ?? player.user.name ?? null;
            
            player.cellsCollected = 0;
            
            if (player?.user?.id) {
                let id = DbRun.oldIdConversionCheck(player.user.id);
                player.user.id = id;
                if (!player.user.name || player.user.name.length == 0)
                    player.user.name = (name.length != 0 ? name : userCollection.users.find(x => x.id === id)?.name) ?? "";

                this.playerIds.push(id);
            }
            else if (name) {
                if (!player.user)
                    player.user = new UserBase("", name);
                //REPEAT FOR EVERY USER WHO'S DONE A RUN WITHOUT AN ID
                if (name === "idexzz" || name === "Dexz") {
                    let id = ""; //ADD GUID HERE
                    player.user.id = DbRun.oldIdConversionCheck(id);
                    player.user.name = name;
                    this.playerIds.push(id);
            }
        });
        
        team.tasks.forEach((task, i) => {
            task.obtainedById = DbRun.oldIdConversionCheck(task.obtainedById);

            if (!task.obtainedByName)
                team.tasks[i].obtainedByName = task.obtainedBy;
            let player = team.players.find(x => x.user.name === task.obtainedByName) ?? team.players.find(x => x.user.id === task.obtainedById);
            if (player) {
                if (!task.obtainedByName)
                    task.obtainedByName = player.user.name;
                if (Task.isCell(task.gameTask)) {
                    player.cellsCollected += 1;
                    team.tasks[i].isCell = true;
                    run.teams[index].cellCount += 1;
                }
                else
                    team.tasks[i].isCell = false;
                team.tasks[i].obtainedById = player.user.id;
            }
            
        });

        if (team?.tasks && team.tasks.length !== 0) {
            let teamEndTask = team.tasks[0];
            run.teams[index].endTime = teamEndTask.gameTask !== Task.forfeit ? teamEndTask.obtainedAt : "DNF";
        }
        
        this.teams.push(new DbTeam(team));
    }

    convertOldRun2(run: Run) {
        this.data = Object.assign(new RunData(run.data.buildVersion), run.data);
        if (this.data.mode == RunMode.Speedrun && (this.data.allowSoloHubZoomers == false && (this.data.sharedWarpGatesBetweenTeams == false || this.teams.length === 1) && this.data.citadelSkip == CitadelOption.Shared) || (this.teams.length === 1 && this.teams[0].players.length === 1)) {
          if (this.teams.some(x => x.cellCount === 101)) 
            this.data.category = CategoryOption.AllCells;
          else if (this.teams.some(x => x.cellCount > 72) && this.data.noLTS == true)
            this.data.category = CategoryOption.NoLts;
          else
            this.data.category = CategoryOption.Custom;
        }
        else
          this.data.category = CategoryOption.Custom;
    }


    static oldIdConversionCheck(id: string): string {
        //REPEAT FOR EVERY USER WITH MULTIPLE IDS (SHOULD BE SWAPPED TO A MIGRATE USER TO ID FUNCTION IN FUTURE)
        if (id == "")
            id = "";

        return id;
    }*/
}