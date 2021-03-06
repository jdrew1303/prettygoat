import "reflect-metadata";
import expect = require("expect.js");
import {IMock, Mock, Times, It} from "typemoq";
import IProjectionRegistry from "../scripts/registry/IProjectionRegistry";
import RegistryEntry from "../scripts/registry/RegistryEntry";
import MockProjectionDefinition from "./fixtures/definitions/MockProjectionDefinition";
import MemoizingProjectionRegistry from "../scripts/registry/MemoizingProjectionRegistry";

describe("Given a MemoizingProjectionRegistry", () => {

    let subject: IProjectionRegistry;
    let registry: IMock<IProjectionRegistry>;
    let entry: RegistryEntry<any>;

    beforeEach(() => {
        entry = new RegistryEntry(new MockProjectionDefinition().define(), null);
        registry = Mock.ofType<IProjectionRegistry>();
        registry.setup(r => r.getEntry("Foo", "Admin")).returns(() => {
            return {area: "Admin", data: entry};
        });
        subject = new MemoizingProjectionRegistry(registry.object);
    });

    context("when an entry is requested", () => {
        context("and a cached one does not exist", () => {
            it("should retrieve it from the registry", () => {
                let cached = subject.getEntry("Foo", "Admin");
                expect(cached).to.eql({
                    area: "Admin", data: entry
                });
                registry.verify(r => r.getEntry("Foo", "Admin"), Times.once());
            });
        });

        context("and a cached one exists", () => {
            beforeEach(() => subject.getEntry("Foo", "Admin"));
            it("should serve it from cache", () => {
                let cached = subject.getEntry("Foo", "Admin");
                expect(cached).to.eql({
                    area: "Admin", data: entry
                });
                registry.verify(r => r.getEntry("Foo", "Admin"), Times.once());
            });
        });
    });
});