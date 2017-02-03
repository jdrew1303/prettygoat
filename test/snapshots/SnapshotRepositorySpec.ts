import "reflect-metadata";
import expect = require("expect.js");
import CassandraSnapshotRepository from "../../scripts/cassandra/CassandraSnapshotRepository";
import * as TypeMoq from "typemoq";
import {Snapshot} from "../../scripts/snapshots/ISnapshotRepository";
import IProjectionRegistry from "../../scripts/registry/IProjectionRegistry";
import ProjectionRegistry from "../../scripts/registry/ProjectionRegistry";
import MockCassandraClient from "../fixtures/cassandra/MockCassandraClient";
import ICassandraClient from "../../scripts/cassandra/ICassandraClient";
import * as Rx from "rx";
import RegistryEntry from "../../scripts/registry/RegistryEntry";
import MockProjectionDefinition from "../fixtures/definitions/MockProjectionDefinition";
import SplitProjectionDefinition from "../fixtures/definitions/SplitProjectionDefinition";

describe("Snapshot repository, given all the streams", () => {

    let subject: CassandraSnapshotRepository,
        registry: TypeMoq.IMock<IProjectionRegistry>,
        cassandraClient: TypeMoq.IMock<ICassandraClient>;

    beforeEach(() => {
        cassandraClient = TypeMoq.Mock.ofType(MockCassandraClient);
        registry = TypeMoq.Mock.ofType(ProjectionRegistry);
        subject = new CassandraSnapshotRepository(cassandraClient.object, registry.object);
    });

    context("when the snapshots associated needs to be retrieved", () => {
        it("should return the list of available snapshots", () => {
            cassandraClient.setup(c => c.execute("select blobAsText(memento) as memento, streamid, lastEvent, split from projections_snapshots")).returns(a => Rx.Observable.just({
                rows: [
                    {
                        "memento": 56,
                        "lastevent": 7393898,
                        "split": "",
                        "streamid": "list"
                    },
                    {
                        "memento": 7800,
                        "lastevent": 77472487,
                        "split": "first-key",
                        "streamid": "detail"
                    },
                    {
                        "memento": 6000,
                        "lastevent": 77472487,
                        "split": "second-key",
                        "streamid": "detail"
                    }
                ]
            }));
            let snapshots = null;
            subject.getSnapshots().subscribe(value => {
                snapshots = value;
            });
            expect(snapshots).to.eql({
                "list": new Snapshot(56, new Date(7393898)),
                "detail": new Snapshot({
                    "first-key": 7800,
                    "second-key": 6000
                }, new Date(77472487))
            });
        });
        it("should handle correctly escaped strings", () => {
            cassandraClient.setup(c => c.execute("select blobAsText(memento) as memento, streamid, lastEvent, split from projections_snapshots")).returns(a => Rx.Observable.just({
                rows: [
                    {
                        "memento": '"\'\'"',
                        "lastevent": 7393898,
                        "split": "",
                        "streamid": "list"
                    }
                ]
            }));
            let snapshots = null;
            subject.getSnapshots().subscribe(value => {
                snapshots = value;
            });
            expect(snapshots).to.eql({
                "list": new Snapshot("'", new Date(7393898))
            });
        });

        it("should handle correctly undefined values", () => {
            cassandraClient.setup(c => c.execute("select blobAsText(memento) as memento, streamid, lastEvent, split from projections_snapshots")).returns(a => Rx.Observable.just({
                rows: [
                    {
                        memento: 'undefined',
                        streamid: 'Asset:Detail',
                        lastevent: 7393898,
                        split: '6654'
                    }
                ]
            }));
            let snapshots = null;
            subject.getSnapshots().subscribe(value => {
                snapshots = value;
            });
            expect(snapshots).to.eql({
                "Asset:Detail": new Snapshot({"6654": null}, new Date(7393898))
            });
        });
    });

    context("when a snapshot needs to be saved", () => {
        beforeEach(() => {
            cassandraClient.setup(c => c.execute(TypeMoq.It.isAny())).returns(a => Rx.Observable.empty());
        });
        context("and the associated projection is not a split", () => {
            beforeEach(() => {
                registry.setup(r => r.getEntry("test")).returns(a => {
                    return {
                        area: null,
                        data: new RegistryEntry(new MockProjectionDefinition().define(), null)
                    }
                });
            });
            it("should save the snapshot correctly", () => {
                let snapshot = new Snapshot({a: 25}, new Date(500));
                subject.saveSnapshot("test", snapshot);
                cassandraClient.verify(c => c.execute(`insert into projections_snapshots (streamid, split, lastevent, memento) values ('test',` +
                    `'', '${snapshot.lastEvent}', textAsBlob('{"a":25}'))`), TypeMoq.Times.once());
            });
            it("should escape single quotes correctly", () => {
                let snapshot = new Snapshot({a: "''"}, new Date(500));
                subject.saveSnapshot("test", snapshot);
                cassandraClient.verify(c => c.execute(`insert into projections_snapshots (streamid, split, lastevent, memento) values ('test',` +
                    `'', '${snapshot.lastEvent}', textAsBlob('{"a":"''''"}'))`), TypeMoq.Times.once());
            });
            it("should handle correctly a snapshot with an undefined value", () => {
                let snapshotUndefined = new Snapshot(undefined, new Date(500));
                subject.saveSnapshot("test", snapshotUndefined);

                cassandraClient.verify(c => c.execute(`insert into projections_snapshots (streamid, split, lastevent, memento) values ('test',` +
                    `'', '${snapshotUndefined.lastEvent}', textAsBlob('null'))`), TypeMoq.Times.once());
            });
        });

        context("and the associated projection is a split", () => {
            beforeEach(() => {
                registry.setup(r => r.getEntry("split")).returns(a => {
                    return {
                        area: null,
                        data: new RegistryEntry(new SplitProjectionDefinition().define(), null)
                    }
                });
            });
            it("should save every entry in a different row", () => {
                let snapshot = new Snapshot({a: 25, b: 30}, new Date(500));
                let streamId = "split";
                subject.saveSnapshot(streamId, snapshot);
                cassandraClient.verify(c => c.execute(`insert into projections_snapshots (streamid, split, lastevent, memento) values ('split',` +
                    `'a', '${snapshot.lastEvent}', textAsBlob('${JSON.stringify(25)}'))`), TypeMoq.Times.once());
                cassandraClient.verify(c => c.execute(`insert into projections_snapshots (streamid, split, lastevent, memento) values ('split',` +
                    `'b', '${snapshot.lastEvent}', textAsBlob('${JSON.stringify(30)}'))`), TypeMoq.Times.once());
            });
        });
    });

    context("when a snapshot needs to be deleted", () => {
        beforeEach(() => {
            cassandraClient.setup(c => c.execute(TypeMoq.It.isAny())).returns(a => Rx.Observable.empty());
        });
        it("should remove it correctly", () => {
            subject.deleteSnapshot("test");
            cassandraClient.verify(c => c.execute("delete from projections_snapshots where streamid = 'test'"), TypeMoq.Times.once())
        });
    });
});