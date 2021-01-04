var ownId, groundId;
var movementSpeed = 80;
var totalObjects = 1000;
var objectSize = 5;
var sizeRandomness = 4000;
var dirs = [];
var parts = [];
var colors = [0xFF0FFF, 0xCCFF00, 0xFF000F, 0x996600, 0xFFFFFF];
var hit = new Audio('sound.mp3');
var catchBall = new Audio('catch.wav');
var gotAHit = new Audio('gotahit.mp3');
var targetHit = new Audio('targethit.mp3');
var gameOver = new Audio('game-over.wav');
var score = 0
var health = 25;

var PointerLockControls = function (camera, cannonBody) {

    var velocityFactor = 0.2;
    var jumpVelocity = 20;
    var scope = this;


    var pitchObject = new THREE.Object3D();
    pitchObject.add(camera);

    var yawObject = new THREE.Object3D();
    yawObject.position.y = 2;
    yawObject.add(pitchObject);

    var quat = new THREE.Quaternion();

    var moveForward = false;
    var moveBackward = false;
    var moveLeft = false;
    var moveRight = false;

    var canJump = false;

    var contactNormal = new CANNON.Vec3(); // Normal in the contact, pointing *out* of whatever the player touched
    var upAxis = new CANNON.Vec3(0, 1, 0);
    cannonBody.addEventListener("collide", function (e) {
        var contact = e.contact;


        if (contact.si.constructor.name == 'Sphere' && contact.sj.constructor.name == 'Sphere') {
            gotAHit.play();
            gotAHit.play();
            reduceHealth();
        }

        // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
        // We do not yet know which one is which! Let's check.
        if (contact.bi.id == cannonBody.id)  // bi is the player body, flip the contact normal
        {
            console.log(contact.bi.id, cannonBody.id);
            contact.ni.negate(contactNormal);
        }
        else {
            contactNormal.copy(contact.ni); // bi is something else. Keep the normal as it is

        }
        // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
        if (contactNormal.dot(upAxis) > 0.5) // Use a "good" threshold value between 0 and 1 here!
            canJump = true;
    });

    var velocity = cannonBody.velocity;

    var PI_2 = Math.PI / 2;

    var onMouseMove = function (event) {

        if (scope.enabled === false) return;

        var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        yawObject.rotation.y -= movementX * 0.002;
        pitchObject.rotation.x -= movementY * 0.002;

        pitchObject.rotation.x = Math.max(- PI_2, Math.min(PI_2, pitchObject.rotation.x));
    };

    var onKeyDown = function (event) {

        switch (event.keyCode) {

            case 38: // up
            case 87: // w
                moveForward = true;
                break;

            case 37: // left
            case 65: // a
                moveLeft = true; break;

            case 40: // down
            case 83: // s
                moveBackward = true;
                break;

            case 39: // right
            case 68: // d
                moveRight = true;
                break;

            case 32: // space
                if (canJump === true) {
                    velocity.y = jumpVelocity;
                }
                canJump = false;
                break;
        }

    };

    var onKeyUp = function (event) {

        switch (event.keyCode) {

            case 38: // up
            case 87: // w
                moveForward = false;
                break;

            case 37: // left
            case 65: // a
                moveLeft = false;
                break;

            case 40: // down
            case 83: // a
                moveBackward = false;
                break;

            case 39: // right
            case 68: // d
                moveRight = false;
                break;

        }

    };

    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    this.enabled = false;

    this.getObject = function () {
        return yawObject;
    };

    this.getDirection = function (targetVec) {
        targetVec.set(0, 0, -1);
        quat.multiplyVector3(targetVec);
    }

    // Moves the camera to the Cannon.js object position and adds velocity to the object if the run key is down
    var inputVelocity = new THREE.Vector3();
    var euler = new THREE.Euler();
    this.update = function (delta) {

        if (scope.enabled === false) return;

        delta *= 0.1;

        inputVelocity.set(0, 0, 0);

        if (moveForward) {
            inputVelocity.z = -velocityFactor * delta;
        }
        if (moveBackward) {
            inputVelocity.z = velocityFactor * delta;
        }

        if (moveLeft) {
            inputVelocity.x = -velocityFactor * delta;
        }
        if (moveRight) {
            inputVelocity.x = velocityFactor * delta;
        }

        // Convert velocity to world coordinates
        euler.x = pitchObject.rotation.x;
        euler.y = yawObject.rotation.y;
        euler.order = "XYZ";
        quat.setFromEuler(euler);
        inputVelocity.applyQuaternion(quat);
        //quat.multiplyVector3(inputVelocity);

        // Add to the object
        velocity.x += inputVelocity.x;
        velocity.z += inputVelocity.z;

        yawObject.position.copy(cannonBody.position);
    };
};



//########################
// code start

var sphereShape, sphereBody, world, physicsMaterial, walls = [], balls = [], ballMeshes = [], boxes = [], boxMeshes = [],
    targetBoxes = [], targetMeshes = [];

var camera, scene, renderer;
var geometry, material, mesh, texture, gltf;
var controls, time = Date.now();

var blocker = document.getElementById('blocker');
var instructions = document.getElementById('instructions');
var gameOverDialog = document.getElementById('gameoverdialog');
var resultDetails = document.getElementById('result_details');

var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

if (havePointerLock) {

    var element = document.body;

    var pointerlockchange = function (event) {
        if(!controls){
            return;
        }

        if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {

            controls.enabled = true;

            blocker.style.display = 'none';

        } else {

            controls.enabled = false;

            blocker.style.display = '-webkit-box';
            blocker.style.display = '-moz-box';
            blocker.style.display = 'box';

            instructions.style.display = '';

        }

    }

    var pointerlockerror = function (event) {
        instructions.style.display = '';
    }

    // Hook pointer lock state change events
    document.addEventListener('pointerlockchange', pointerlockchange, false);
    document.addEventListener('mozpointerlockchange', pointerlockchange, false);
    document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

    document.addEventListener('pointerlockerror', pointerlockerror, false);
    document.addEventListener('mozpointerlockerror', pointerlockerror, false);
    document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

    instructions.addEventListener('click', function (event) {
        instructions.style.display = 'none';

        // Ask the browser to lock the pointer
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

        if (/Firefox/i.test(navigator.userAgent)) {

            var fullscreenchange = function (event) {

                if (document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element) {

                    document.removeEventListener('fullscreenchange', fullscreenchange);
                    document.removeEventListener('mozfullscreenchange', fullscreenchange);

                    element.requestPointerLock();
                }

            }

            document.addEventListener('fullscreenchange', fullscreenchange, false);
            document.addEventListener('mozfullscreenchange', fullscreenchange, false);

            element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;

            element.requestFullscreen();

        } else {

            element.requestPointerLock();

        }

    }, false);

} else {

    instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';

}

document.addEventListener("DOMContentLoaded", function(){
    initCannon();
    init();
  });

function initCannon() {
    // Setup our world
    world = new CANNON.World();
    world.quatNormalizeSkip = 0;
    world.quatNormalizeFast = false;

    var solver = new CANNON.GSSolver();

    world.defaultContactMaterial.contactEquationStiffness = 1e9;
    world.defaultContactMaterial.contactEquationRelaxation = 4;

    solver.iterations = 7;
    solver.tolerance = 0.1;
    var split = true;
    if (split)
        world.solver = new CANNON.SplitSolver(solver);
    else
        world.solver = solver;

    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();

    // Create a slippery material (friction coefficient = 0.0)
    physicsMaterial = new CANNON.Material("slipperyMaterial");
    var physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial,
        physicsMaterial,
        0.0, // friction coefficient
        0.3  // restitution
    );
    // We must add the contact materials to the world
    world.addContactMaterial(physicsContactMaterial);

    // Create a sphere
    var mass = 5, radius = 1.3;
    sphereShape = new CANNON.Sphere(radius);
    sphereBody = new CANNON.Body({ mass: mass });
    ownId = sphereBody.id;
    sphereBody.addShape(sphereShape);
    sphereBody.position.set(0, 5, 0);
    sphereBody.linearDamping = 0.9;
    world.add(sphereBody);

    // Create a plane
    var groundShape = new CANNON.Plane();
    var groundBody = new CANNON.Body({ mass: 0 });
    groundId = groundBody.id;
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.add(groundBody);
}

function init() {
    console.log("init called")
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    scene = new THREE.Scene();

    const loader = new THREE.GLTFLoader();
    loader.load(
        'corona-3d/scene.gltf',
        function (converted) {
            console.log("loaded");
            gltf = converted;
            animate();
            texture = new THREE.TextureLoader().load("covid.jpg");
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);


            setInterval(function () {
                console.log(scene.children.length);
            }, 2000)



            scene.fog = new THREE.Fog(0x000000, 0, 500);

            var ambient = new THREE.AmbientLight(0x404040);
            scene.add(ambient);

            let light = new THREE.SpotLight(0xffffff);
            light.position.set(10, 30, 20);
            light.target.position.set(0, 0, 0);
            if (true) {
                light.castShadow = true;

                light.shadow.camera.near = 20;
                light.shadow.camera.far = 50;//camera.far;
                light.shadow.camera.fov = 40;

                light.shadowMapBias = 0.1;
                light.shadowMapDarkness = 0.7;
                light.shadow.mapSize.width = 2 * 512;
                light.shadow.mapSize.height = 2 * 512;

                //light.shadowCameraVisible = true;
            }
            scene.add(light);



            controls = new PointerLockControls(camera, sphereBody);
            scene.add(controls.getObject());

            // floor
            geometry = new THREE.PlaneGeometry(300, 300, 50, 50);
            geometry.applyMatrix(new THREE.Matrix4().makeRotationX(- Math.PI / 2));

            material = new THREE.MeshLambertMaterial({ color: 0x2194ce });

            mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.shadowMap.enabled = true;
            renderer.shadowMapSoft = true;
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(scene.fog.color, 1);

            document.body.appendChild(renderer.domElement);

            window.addEventListener('resize', onWindowResize, false);

            // Add boxes
            var halfExtents = new CANNON.Vec3(1, 1, 1);
            var boxShape = new CANNON.Box(halfExtents);
            var boxShape = new CANNON.Sphere(0.5);
            var boxGeometry = new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2);
            var boxGeometry = new THREE.SphereGeometry(0.5, 20, 20);


            // var x = (Math.random()-0.5)*20;
            // var y = 1 + (Math.random()-0.5)*50;
            // var z = (Math.random()-0.5)*20;


            // Add target
            var size = 0.5;
            var he = new CANNON.Vec3(size, size, size * 0.1);
            var boxShape = new CANNON.Box(he);
            var mass = 0;
            var space = 0.1 * size;
            // var boxGeometry = new THREE.BoxGeometry(he.x*2,he.y*2,he.z*2);
            var boxGeometry = new THREE.SphereGeometry(1, 20, 20, 0, Math.PI * 2, 0, Math.PI * 2);
            var boxbody = new CANNON.Body({ mass: mass });
            var randomColor = '#' + (Math.random() * 0xFFFFFF << 0).toString(16);
            // material2 = new THREE.MeshBasicMaterial( { color: randomColor } );
            material2 = new THREE.MeshBasicMaterial({
                color: randomColor,
                wireframe: true,
                wireframeLinewidth: 0.1
            })
            boxbody.addShape(boxShape);
            var positionX = (Math.random() - 0.5) * 40;
            var boxMesh = new THREE.Mesh(boxGeometry, material2);
            boxbody.position.set(positionX, (2) * (size * 2 + 2 * space) + size * 2 + space, 0);
            boxbody.linearDamping = 0.01;
            boxbody.angularDamping = 0.01;
            boxMesh.receiveShadow = true;
            world.add(boxbody);
            scene.add(boxMesh);
            targetBoxes.push(boxbody);
            targetMeshes.push(boxMesh);

            let listener = function (e) {
                catchBall.play();
                // boxbody.removeEventListener("collide", listener);    
                boxbody.position.set(positionX, (2) * (size * 2 + 2 * space) + size * 2 + space, 0)
                light.position.set(positionX, (2) * (size * 2 + 2 * space) + size * 2 + space, 0);

                light.position.set(positionX, (2) * (size * 2 + 2 * space) + size * 2 + space, 0);

                covidModel.position.set(positionX + 2 - 5.5, (2) * (size * 2 + 2 * space) + size * 2 + space + 1.2, 0);


                randomColor = '#' + (Math.random() * 0xFFFFFF << 0).toString(16);
                boxMesh.material.color.set(randomColor);
                // lightSphere.material.color.set(randomColor);
                light.color.set(randomColor);

                increaseCounter();
                parts.push(new ExplodeAnimation(positionX, (2) * (size * 2 + 2 * space) + size * 2 + space));
                positionX = (Math.random() - 0.5) * 40;
                render();
                targetHit.play();

                function render() {
                    requestAnimationFrame(render);

                    var pCount = parts.length;
                    while (pCount--) {
                        parts[pCount].update();
                    }

                    // renderer.render(scene, camera);
                }
            }

            boxbody.addEventListener("collide", listener);


            light = new THREE.PointLight(0xff0000, 1, 100);
            light.position.set(positionX, (2) * (size * 2 + 2 * space) + size * 2 + space, 0);

            var covidModel = gltf.scene.children[0];
            covidModel.position.set(positionX + 2 - 5.5, (2) * (size * 2 + 2 * space) + size * 2 + space + 1.2, 0);


            // var lightMesh = new THREE.MeshStandardMaterial({ color: randomColor });
            gltf.scene.children[0].scale.set(0.025, 0.025, 0.025);
            scene.add(covidModel);
            scene.add(light);

        },
        // called while loading is progressing
        function (xhr) {

            console.log((xhr.loaded / xhr.total * 100) + '% loaded');

        },
        // called when loading has errors
        function (error) {
            console.log('An error happened');

        }
    );

}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

var dt = 1 / 60;

var count = 0;
function animate() {
    requestAnimationFrame(animate);
    if (controls && controls.enabled) {
        world.step(dt);

        // Update ball positions
        for (var i = 0; i < balls.length; i++) {
            ballMeshes[i].position.copy(balls[i].position);
            ballMeshes[i].quaternion.copy(balls[i].quaternion);

        }


        for (var i = 0; i < targetBoxes.length; i++) {
            targetMeshes[i].position.copy(targetBoxes[i].position);
            targetMeshes[i].quaternion.copy(targetBoxes[i].quaternion);
            // if (count % 9 == 0) {
            //     targetMeshes[i].scale.set((count % 10) / 10 + 0.5, (count % 10) / 10 + (0.5), (count % 10) / 10 + (0.5));
            // }
        }

        if (undefined && count % 30 == 0 && boxMeshes.length < 500) {
            var halfExtents = new CANNON.Vec3(1, 1, 1);
            var boxShape = new CANNON.Box(halfExtents);
            var boxShape = new CANNON.Sphere(0.5);
            var boxGeometry = new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2);
            var boxGeometry = new THREE.SphereGeometry(0.5, 20, 20);

            var x = (Math.random() - 0.5) * 40;
            var y = 1 + (Math.random() - 0.5) * 1;
            var z = (Math.random() - 0.5) * 40;
            var boxBody = new CANNON.Body({ mass: 5 });
            boxBody.addShape(boxShape);

            // var shootDirection = new THREE.Vector3();
            // getShootDir(shootDirection);

            boxBody.velocity.set((x - sphereBody.position.x) * -1,
                0,
                (z - sphereBody.position.z) * -1);



            var randomColor = '#' + (Math.random() * 0xFFFFFF << 0).toString(16);
            material2 = new THREE.MeshLambertMaterial({ color: randomColor, map: texture });
            var boxMesh = new THREE.Mesh(boxGeometry, material2);
            world.add(boxBody);
            scene.add(boxMesh);
            boxBody.position.set(x, y, z);
            boxMesh.position.set(x, y, z);
            boxMesh.castShadow = true;
            boxMesh.receiveShadow = true;
            boxes.push(boxBody);
            boxMeshes.push(boxMesh);



            if (count == 60) {
                count = 0;
                let removedMesh = boxMeshes[0];
                scene.getObjectById(removedMesh.id).geometry.dispose();
                scene.getObjectById(removedMesh.id).material.dispose();
                scene.remove(scene.getObjectById(removedMesh.id));
                let removedElemMesh = boxMeshes.shift();
                let removedElem = boxes.shift();
                removedElemMesh = undefined;
                removedElem = undefined;
                renderer.render(scene, camera);
            }
        }
        count++;




        // Update box positions
        for (var i = 0; i < boxes.length; i++) {



            boxMeshes[i].position.copy(boxes[i].position);
            boxMeshes[i].quaternion.copy(boxes[i].quaternion);




            // try to come again
            // console.log(boxMeshes[i].position)
            // boxMeshes[i].position.setX((controls.getObject().position.x -  boxMeshes[i].position.x < 0) ? boxMeshes[i].position.x+1 :boxMeshes[i].position.x-1);
            // // boxMeshes[i].position.setY((controls.getObject().position.y -  boxMeshes[i].position.y < 0) ? boxMeshes[i].position.y+1 :boxMeshes[i].position.y-1);
            // boxMeshes[i].position.setZ((controls.getObject().position.z -  boxMeshes[i].position.z < 0) ? boxMeshes[i].position.z+1 :boxMeshes[i].position.z-1);
            // console.log(boxMeshes[i].position)


        }
        controls.update(Date.now() - time);
        renderer.render(scene, camera);
        time = Date.now();
    }

}

function ExplodeAnimation(x, y) {


    if (parts.length > 1) {
        let part = parts.shift();
        part.object.geometry.dispose();
        part.object.material.dispose();
        scene.remove(part.object);
        dirs = [];
        renderer.render(scene, camera);
    }

    var geometry = new THREE.Geometry();
    for (i = 0; i < totalObjects; i++) {
        var vertex = new THREE.Vector3();
        vertex.x = x;
        vertex.y = y;
        vertex.z = 0;

        geometry.vertices.push(vertex);

        dirs.push({ x: (Math.random() * movementSpeed) - (movementSpeed / 2), y: (Math.random() * movementSpeed) - (movementSpeed / 2), z: (Math.random() * movementSpeed) - (movementSpeed / 2) });
    }
    var material = new THREE.ParticleBasicMaterial({ size: objectSize, color: colors[Math.round(Math.random() * colors.length)] });
    var particles = new THREE.ParticleSystem(geometry, material);

    this.object = particles;
    this.status = true;

    this.xDir = (Math.random() * movementSpeed) - (movementSpeed / 2);
    this.yDir = (Math.random() * movementSpeed) - (movementSpeed / 2);
    this.zDir = (Math.random() * movementSpeed) - (movementSpeed / 2);

    scene.add(this.object);

    this.update = function () {
        if (this.status == true) {
            var pCount = totalObjects;
            while (pCount--) {
                var particle = this.object.geometry.vertices[pCount]
                particle.y += dirs[pCount].y;
                particle.x += dirs[pCount].x;
                particle.z += dirs[pCount].z;
            }
            this.object.geometry.verticesNeedUpdate = true;
        }
    }

    let obj = this.object;
    setTimeout(function () {
        if (obj) {
            scene.getObjectById(obj.id, true).geometry.dispose();
            scene.getObjectById(obj.id, true).material.dispose();
            scene.remove(scene.getObjectById(obj.id));
        }
    }, 2000);

}

var ballShape = new CANNON.Sphere(0.2);
var ballGeometry = new THREE.SphereGeometry(ballShape.radius, 32, 32, 0, Math.PI * 2, 0, Math.PI * 2)
// new THREE.SphereGeometry(ballShape.radius, 32, 32);
var shootDirection = new THREE.Vector3();
var shootVelo = 35;
var projector = new THREE.Projector();
function getShootDir(targetVec, displacementX) {

    var vector = targetVec;
    targetVec.set(0, 0, 1);
    displacementX = displacementX * 3.14 / 180;


    vector.unproject(camera);
    // let position = sphereBody.position;
    // console.log(camera);
    // vector.x = vector.x - displacementX;

    vector.x = vector.x * Math.cos(displacementX) - vector.z * Math.sin(displacementX);
    vector.z = vector.x * Math.sin(displacementX) + vector.z * Math.cos(displacementX);





    var ray = new THREE.Ray(sphereBody.position, vector.sub(sphereBody.position).normalize());
    targetVec.copy(ray.direction);
}

window.addEventListener("click", function (e) {
    if (controls && controls.enabled == true) {
        var x = sphereBody.position.x;
        var y = sphereBody.position.y;
        var z = sphereBody.position.z;


        for (let ballidx = 0; ballidx < 5; ballidx++) {

            let obj = {
                "0": "0",
                "1": "-20",
                "2": "20",
                "3": "-40",
                "4": "40",
                "5": "-75",
                "6": "75"
            }

            getShootDir(shootDirection, obj[ballidx]);

            let ballBody = new CANNON.Body({ mass: 1 });
            ballBody.addShape(ballShape);
            var randomColor = '#' + (Math.random() * 0xFFFFFF << 0).toString(16);
            // var texture = new THREE.TextureLoader().load('blaze.gif');
            material2 = new THREE.MeshBasicMaterial({
                // map:texture,
                color: new THREE.Color("lightgreen"),
                wireframe: true
            })
            //   THREE.MeshPhongMaterial( { color: randomColor } );
            let ballMesh = new THREE.Mesh(ballGeometry, material2);
            world.add(ballBody);
            scene.add(ballMesh);
            ballMesh.castShadow = true;
            ballMesh.receiveShadow = true;



            balls.push(ballBody);
            ballMeshes.push(ballMesh);

            ballBody.velocity.set(shootDirection.x * shootVelo,
                shootDirection.y * shootVelo,
                shootDirection.z * shootVelo);

            // Move the ball outside the player sphere
            x += shootDirection.x * (sphereShape.radius * 1.02 + ballShape.radius);
            y += shootDirection.y * (sphereShape.radius * 1.02 + ballShape.radius);
            z += shootDirection.z * (sphereShape.radius * 1.02 + ballShape.radius);
            ballBody.position.set(x, y, z);
            ballMesh.position.set(x, y, z);


            ballBody.addEventListener("collide", function (e) {
                if ([ownId, groundId].includes(e.contact.bi.id)) {

                } else if (boxes.map(x => x.id).includes(e.contact.bi.id)) {
                    let boxIdx = boxes.findIndex(x => x.id == e.contact.bi.id);
                    let removedMesh = boxMeshes[boxIdx];
                    scene.getObjectById(removedMesh.id, true).geometry.dispose();
                    scene.getObjectById(removedMesh.id, true).material.dispose();
                    scene.remove(scene.getObjectById(removedMesh.id));
                    // console.log(boxIdx)
                    boxMeshes.splice(boxIdx, 1);
                    boxes.splice(boxIdx, 1);

                    if (ballMesh && scene.getObjectById(ballMesh.id, true)) {
                        // console.log("~~~ball mesh ", ballMesh.id, ballMeshes);
                        scene.getObjectById(ballMesh.id, true).geometry.dispose();
                        scene.getObjectById(ballMesh.id, true).material.dispose();
                        scene.remove(scene.getObjectById(ballMesh.id));

                        let idx = ballMeshes.findIndex(x => x.id == ballMesh.id);
                        ballMeshes.splice(idx, 1);
                        balls[idx] = undefined;
                        balls.splice(idx, 1);
                        ballMesh = undefined;
                        remove = undefined;

                    }
                    removedMesh = undefined;
                    const color = 0xFFFFFF;
                    const intensity = 1;

                    // const light = new THREE.PointLight(color, intensity);
                    // light.position.set(e.contact.ni.x, e.contact.ni.y, e.contact.ni.z);

                    // scene.add(light);
                    hit.play();

                } else {
                    // console.log(e.contact.bi.id);
                    // console.log(e);
                }
            });


            setTimeout(function () {
                if (ballMesh && scene.getObjectById(ballMesh.id, true)) {
                    scene.getObjectById(ballMesh.id, true).geometry.dispose();
                    scene.getObjectById(ballMesh.id, true).material.dispose();
                    scene.remove(scene.getObjectById(ballMesh.id));

                    let idx = ballMeshes.findIndex(x => x.id == ballMesh.id);
                    ballMeshes.splice(idx, 1);
                    balls[idx] = undefined
                    balls.splice(idx, 1);

                    ballMesh = undefined;


                }
            }, 3000);



        }

    }
});

function increaseCounter() {
    document.getElementById("score").innerHTML = Number(document.getElementById("score").innerHTML) + 1;
}

function reduceHealth() {
    document.getElementById("health").style.width = (document.getElementById("health").style.width.replace("px", "") - 10) + "px";
    if ((document.getElementById("health").style.width.replace("px", "") - 8) < 0) {
        controls.enabled = false;

        document.getElementById("result").innerHTML = document.getElementById("score").innerHTML;

        gameOverDialog.style.display = '-webkit-box';
        gameOverDialog.style.display = '-moz-box';
        gameOverDialog.style.display = 'box';

        resultDetails.style.display = '';
        gameOver.play();
        document.onkeydown = function (event) {
            if (event.keyCode == 13) {
                location.reload();
            }
        }
        // location.reload();
    }
}