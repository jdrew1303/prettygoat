import * as express from 'express';
import {injectable, inject} from 'inversify';
import Dictionary from "../Dictionary";
import IProjectionRunner from "../projections/IProjectionRunner";
import {Controller, Get, Post} from 'inversify-express-utils';
import {ISnapshotRepository, Snapshot} from "../snapshots/ISnapshotRepository";
import IDateRetriever from "../util/IDateRetriever";

@Controller('/api/authorization')
@injectable()
class AuthorizationController implements Controller {

    constructor(@inject("IProjectionRunnerHolder") private projectionsRunnerCollection: Dictionary<IProjectionRunner<any>>,
                @inject("ISnapshotRepository") private snapshotRepository: ISnapshotRepository,
                @inject("IDateRetriever") private dateRetriever: IDateRetriever) {
    }

    @Get('/check')
    isAuthorized(request: express.Request, response: express.Response): void {
        response.json({authorization: "success"});
    }

}

export default AuthorizationController;