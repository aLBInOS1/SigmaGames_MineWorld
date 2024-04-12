import { PointerLockControls } from "../../three/examples/jsm/controls/PointerLockControls.js";
import * as CameraConstants from "../constants/CameraConstants.js";
import * as WorldConstants from "../constants/WorldConstants.js";

export class PlayerControls extends PointerLockControls {
    constructor(camera, domElement, world, scene) {
        super(camera, domElement);
        this.camera = camera;

        this.wireframeOn = false;

        this.world = world;

        this.addEventListener("lock", function () {});
        this.addEventListener("unlock", function () {});

        var self = this;
        document.body.addEventListener("click", function () {
            self.lock();
        });

        // keyboard controls
        this.keys = [];
        window.addEventListener("keydown", (e) => {
            alert(e.key);
            self.keys.push(e.keyCode);
        });
        window.addEventListener("keyup", (e) => {
            var arr = [];
            for (var i = 0; i < self.keys.length; i++) {
                if (self.keys[i] != e.keyCode) {
                    arr.push(self.keys[i]);
                }
            }
            self.keys = arr;
        });

        // mouse controls
        window.addEventListener(
            "mousedown",
            (event) => {
                event.preventDefault();

                // left click
                if (event.button === 0)
                    window.addEventListener(
                        "mouseup",
                        self.placeVoxel(WorldConstants.BLOCK_TYPES.AIR)
                    );

                // right click
                if (event.button === 2)
                    window.addEventListener(
                        "mouseup",
                        self.placeVoxel(self.camera.currBlock)
                    );
            },
            { passive: false }
        );

        // voxel highlight
        const geometry = new THREE.EdgesGeometry(
            new THREE.BoxGeometry(1.005, 1.005, 1.005)
        );
        const material = new THREE.LineBasicMaterial({
            color: "black",
            fog: false,
            linewidth: 2,
            opacity: 0.5,
            transparent: true,
            depthTest: true,
        });
        this.voxelHighlight = new THREE.LineSegments(geometry, material);
        this.voxelHighlight.visible = false;

        scene.add(this.voxelHighlight);

        // hotbar
        this.hotbarButtons = document.querySelectorAll("input.voxel");
        const hotbarButtons = this.hotbarButtons;

        for (const button of hotbarButtons) {
            button.addEventListener("click", (event) => {
                event.preventDefault();
            });

            if (button.id == camera.currBlock.id) {
                button.checked = true;
            }
        }

        window.addEventListener("wheel", (event) => {
            for (const button of hotbarButtons) {
                if (button.checked) {
                    var nextButton;
                    const id = parseInt(button.id);
                    if (event.deltaY > 0) {
                        nextButton =
                            id === hotbarButtons.length - 1
                                ? hotbarButtons[0]
                                : hotbarButtons.item(id + 1);
                    } else {
                        nextButton =
                            id === 0
                                ? hotbarButtons.item(hotbarButtons.length - 1)
                                : hotbarButtons.item(id - 1);
                    }
                    button.checked = false;
                    nextButton.checked = true;

                    camera.currBlock = Object.entries(
                        WorldConstants.BLOCK_TYPES
                    )[parseInt(nextButton.id) + 1][1];
                    break;
                }
            }
        });

        const box = new THREE.BoxGeometry(0.8, 1.75, 0.8);
        const boxMaterial = new THREE.MeshBasicMaterial({
            color: "black",
            side: THREE.FrontSide,
        });
        this.boundingBox = new THREE.Mesh(box, boxMaterial);

        this.updateBoundingBox();
        scene.add(this.boundingBox);
    }

    update() {
        // movement controls
        const { keys, camera, boundingBox } = this;

        const currPosition = camera.position.clone();

        // w
        if (keys.includes(87)) {
            this.moveForward(CameraConstants.MOVEMENT_SPEED);
        }
        // a
        if (keys.includes(65)) {
            this.moveRight(-1 * CameraConstants.MOVEMENT_SPEED);
        }
        // s
        if (keys.includes(83)) {
            this.moveForward(-1 * CameraConstants.MOVEMENT_SPEED);
        }
        // d
        if (keys.includes(68)) {
            this.moveRight(CameraConstants.MOVEMENT_SPEED);
        }

        // space
        if (keys.includes(32)) {
            this.getObject().position.y += CameraConstants.MOVEMENT_SPEED;
        }

        // shift
        if (keys.includes(16)) {
            this.getObject().position.y -= CameraConstants.MOVEMENT_SPEED;
        }

        const newPosition = camera.position;
        this.detectCollision(currPosition, newPosition);
        this.updateBoundingBox();

        // block highlighting

        const intersection = camera.calculateIntersection();

        if (intersection) {
            const pos = intersection.position.map((v, ndx) => {
                return Math.ceil(v + intersection.normal[ndx] * -0.5) - 0.5;
            });

            this.voxelHighlight.visible = true;
            this.voxelHighlight.position.set(...pos);
        } else {
            this.voxelHighlight.visible = false;
        }
    }

    updateBoundingBox() {
        const { boundingBox, camera } = this;

        boundingBox.position.set(
            camera.position.x,
            camera.position.y - 0.75,
            camera.position.z
        );
    }

    detectCollision(currPosition, newPosition) {
        const { world, boundingBox } = this;

        const dx = newPosition.x - currPosition.x;
        const dy = newPosition.y - currPosition.y;
        const dz = newPosition.z - currPosition.z;

        var canMoveX = true;
        var canMoveY = true;
        var canMoveZ = true;

        // check each vertex of player's bounding box and see if  player's new position in each direction
        // is blocked by voxel

        for (const vertice of boundingBox.geometry.vertices) {
            const verticeCopy = vertice.clone();
            boundingBox.localToWorld(verticeCopy);

            const nx = verticeCopy.x + dx;
            const ny = verticeCopy.y + dy;
            const nz = verticeCopy.z + dz;

            const px = verticeCopy.x;
            const py = verticeCopy.y;
            const pz = verticeCopy.z;

            if (canMoveX) {
                const voxel = world.getVoxel(nx, py, pz);
                if (voxel && voxel !== WorldConstants.BLOCK_TYPES.WATER)
                    canMoveX = false;
            }
            if (canMoveY) {
                const voxel = world.getVoxel(px, ny, pz);
                if (voxel && voxel !== WorldConstants.BLOCK_TYPES.WATER)
                    canMoveY = false;
            }
            if (canMoveZ) {
                const voxel = world.getVoxel(px, py, nz);
                if (voxel && voxel !== WorldConstants.BLOCK_TYPES.WATER)
                    canMoveZ = false;
            }
        }

        if (!canMoveX) this.getObject().position.x -= dx;
        if (!canMoveY) this.getObject().position.y -= dy;
        if (!canMoveZ) this.getObject().position.z -= dz;
    }

    placeVoxel(voxel) {
        const { camera, world, boundingBox } = this;

        const intersection = camera.calculateIntersection();
        if (intersection) {
            const pos = intersection.position.map((v, ndx) => {
                return v + intersection.normal[ndx] * (voxel ? 0.5 : -0.5);
            });

            // position of voxel being placed
            const fPos = pos.map((x) => {
                return Math.floor(x);
            });

            var canPlace = true;

            // check each vertex of bounding box to check for voxel being placed
            for (const vertice of boundingBox.geometry.vertices) {
                const verticeCopy = vertice.clone();
                boundingBox.localToWorld(verticeCopy);

                const vertPos = Object.values(verticeCopy).map((x) => {
                    return Math.floor(x);
                });

                // don't place voxel if where you're trying to place the voxel is
                // inside the player's body
                if (JSON.stringify(fPos) === JSON.stringify(vertPos))
                    canPlace = false;
            }

            if (canPlace) world.setVoxel(...pos, voxel);
        }
    }
}
