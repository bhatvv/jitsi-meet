
/* global APP, config, require, attachMediaStream, getUserMedia */
var RTCBrowserType = require("./RTCBrowserType");
var Resolutions = require("../../service/RTC/Resolutions");
var AdapterJS = require("./adapter.screenshare");
var MediaStreamType = require("../../service/RTC/MediaStreamTypes");

var currentResolution = null;
cameraSwitched = false;

function getPreviousResolution(resolution) {
console.log("getPreviousResolution");
    if(!Resolutions[resolution])
        return null;
    var order = Resolutions[resolution].order;
    var res = null;
    var resName = null;
    for(var i in Resolutions) {
        var tmp = Resolutions[i];
        if(res == null || (res.order < tmp.order && tmp.order < order)) {
            resName = i;
            res = tmp;
        }
    }
    return resName;
}

function setResolutionConstraints(constraints, resolution) {
console.log("setResolutionConstraints");
    var isAndroid = RTCBrowserType.isAndroid();

    if (Resolutions[resolution]) {
        constraints.video.mandatory.minWidth = Resolutions[resolution].width;
        constraints.video.mandatory.minHeight = Resolutions[resolution].height;
    }
    else if (isAndroid) {
        // FIXME can't remember if the purpose of this was to always request
        //       low resolution on Android ? if yes it should be moved up front
        constraints.video.mandatory.minWidth = 320;
        constraints.video.mandatory.minHeight = 240;
        constraints.video.mandatory.maxFrameRate = 15;
    }

    if (constraints.video.mandatory.minWidth)
        constraints.video.mandatory.maxWidth =
            constraints.video.mandatory.minWidth;
    if (constraints.video.mandatory.minHeight)
        constraints.video.mandatory.maxHeight =
            constraints.video.mandatory.minHeight;
}

function getConstraints(um, resolution, bandwidth, fps, desktopStream) {
console.log("getConstraints");
    var constraints = {audio: false, video: false};
    
    /*if(APP.RTC.localAudio && APP.RTC.localAudio.stream) {
     //resourceJid = test1;
     //jid = APP.xmpp.findJidFromResource(resourceJid);
     //var mediaStream = APP.RTC.remoteStreams[jid][MediaStreamType.VIDEO_TYPE];
     //APP.xmpp.removeStream(mediaStream.stream);
     //console.log("mediastream.stream::",mediaStream);
     //mediaStream.stream.onremovestream();
     //videoElement =$("#largeVideo");
     //videoElement.src = null;
     //this.stream.stop();
     APP.RTC.localAudio.stream.stop();
     APP.xmpp.removeStream(APP.RTC.localAudio.stream);
     
     //cameraSwitched = true;
   	//APP.RTC.changeLocalVideo(APP.RTC.localVideo.stream);
    }*/
    
	if(APP.RTC.localVideo && APP.RTC.localVideo.stream) {
     //videoElement =$("#largeVideo");
     //videoElement.src = null;
     //this.stream.stop();
     //APP.RTC.localVideo.stream.stop();
     APP.xmpp.removeStream(APP.RTC.localVideo.stream);
     
     cameraSwitched = true;
   	//APP.RTC.changeLocalVideo(APP.RTC.localVideo.stream);
     videoTrack = APP.RTC.localVideo.getTracks()[0];
     videoTrack.stop();
     APP.xmpp.removeStream(videoTrack);
    }
    audioSource = audioSelect.value;
	videoSource = videoSelect.value;
  	console.log("audioSource::getConstraints",audioSource);
	console.log("videoSource::getConstraints",videoSource);
    if (um.indexOf('video') >= 0) {
        // same behaviour as true
        constraints.video = { mandatory: {}, optional: [{sourceId: videoSource}] };

        constraints.video.optional.push({ googLeakyBucket: true });

        setResolutionConstraints(constraints, resolution);
    }
    if (um.indexOf('audio') >= 0) {
        if (!RTCBrowserType.isFirefox()) {
            // same behaviour as true
            constraints.audio = { mandatory: {}, optional: [{sourceId: audioSource}]};
            // if it is good enough for hangouts...
            constraints.audio.optional.push(
                {googEchoCancellation: true},
                {googAutoGainControl: true},
                {googNoiseSupression: true},
                {googHighpassFilter: true},
                {googNoisesuppression2: true},
                {googEchoCancellation2: true},
                {googAutoGainControl2: true}
            );
        } else {
            constraints.audio = true;
        }
    }
    if (um.indexOf('screen') >= 0) {
        if (RTCBrowserType.isChrome()) {
            constraints.video = {
                mandatory: {
                    chromeMediaSource: "screen",
                    googLeakyBucket: true,
                    maxWidth: window.screen.width,
                    maxHeight: window.screen.height,
                    maxFrameRate: 3
                },
                optional: []
            };
        } else if (RTCBrowserType.isTemasysPluginUsed()) {
            constraints.video = {
                optional: [
                    {
                        sourceId: AdapterJS.WebRTCPlugin.plugin.screensharingKey
                    }
                ]
            };
        } else if (RTCBrowserType.isFirefox()) {
            constraints.video = {
                mozMediaSource: "window",
                mediaSource: "window"
            };

        } else {
            console.error(
                "'screen' WebRTC media source is supported only in Chrome" +
                " and with Temasys plugin");
        }
    }
    if (um.indexOf('desktop') >= 0) {
        constraints.video = {
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: desktopStream,
                googLeakyBucket: true,
                maxWidth: window.screen.width,
                maxHeight: window.screen.height,
                maxFrameRate: 3
            },
            optional: []
        };
    }

    if (bandwidth) {
        if (!constraints.video) {
            //same behaviour as true
            constraints.video = {mandatory: {}, optional: []};
        }
        constraints.video.optional.push({bandwidth: bandwidth});
    }
    if (fps) {
        // for some cameras it might be necessary to request 30fps
        // so they choose 30fps mjpg over 10fps yuy2
        if (!constraints.video) {
            // same behaviour as true;
            constraints.video = {mandatory: {}, optional: []};
        }
        constraints.video.mandatory.minFrameRate = fps;
    }

    // we turn audio for both audio and video tracks, the fake audio & video seems to work
    // only when enabled in one getUserMedia call, we cannot get fake audio separate by fake video
    // this later can be a problem with some of the tests
    if(RTCBrowserType.isFirefox() && config.firefox_fake_device)
    {
        constraints.audio = true;
        constraints.fake = true;
    }
    return constraints;
}


function RTCUtils(RTCService, onTemasysPluginReady)
{
console.log("RTCUtils");
    var self = this;
    this.service = RTCService;
    if (RTCBrowserType.isFirefox()) {
        var FFversion = RTCBrowserType.getFirefoxVersion();
        if (FFversion >= 40) {
            this.peerconnection = mozRTCPeerConnection;
            this.getUserMedia = navigator.mozGetUserMedia.bind(navigator);
            this.pc_constraints = {};
            this.attachMediaStream =  function (element, stream) {
                //  srcObject is being standardized and FF will eventually
                //  support that unprefixed. FF also supports the
                //  "element.src = URL.createObjectURL(...)" combo, but that
                //  will be deprecated in favour of srcObject.
                //
                // https://groups.google.com/forum/#!topic/mozilla.dev.media/pKOiioXonJg
                // https://github.com/webrtc/samples/issues/302
                if(!element[0])
                    return;
                element[0].mozSrcObject = stream;
                element[0].play();
            };
            this.getStreamID =  function (stream) {
                var id = stream.id;
                if (!id) {
                    var tracks = stream.getVideoTracks();
                    if (!tracks || tracks.length === 0) {
                        tracks = stream.getAudioTracks();
                    }
                    id = tracks[0].id;
                }
                return APP.xmpp.filter_special_chars(id);
            };
            this.getVideoSrc = function (element) {
                if(!element)
                    return null;
                return element.mozSrcObject;
            };
            this.setVideoSrc = function (element, src) {
                if(element)
                    element.mozSrcObject = src;
            };
            RTCSessionDescription = mozRTCSessionDescription;
            RTCIceCandidate = mozRTCIceCandidate;
        } else {
            console.error(
                "Firefox version too old: " + FFversion + ". Required >= 40.");
            window.location.href = 'unsupported_browser.html';
            return;
        }

    } else if (RTCBrowserType.isChrome() || RTCBrowserType.isOpera()) {
        this.peerconnection = webkitRTCPeerConnection;
        this.getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
        this.attachMediaStream = function (element, stream) {
            element.attr('src', webkitURL.createObjectURL(stream));
        };
        this.getStreamID = function (stream) {
            // streams from FF endpoints have the characters '{' and '}'
            // that make jQuery choke.
            return APP.xmpp.filter_special_chars(stream.id);
        };
        this.getVideoSrc = function (element) {
            if(!element)
                return null;
            return element.getAttribute("src");
        };
        this.setVideoSrc = function (element, src) {
            if(element)
                element.setAttribute("src", src);
        };
        // DTLS should now be enabled by default but..
        this.pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': 'true'}]};
        if (RTCBrowserType.isAndroid()) {
            this.pc_constraints = {}; // disable DTLS on Android
        }
        if (!webkitMediaStream.prototype.getVideoTracks) {
            webkitMediaStream.prototype.getVideoTracks = function () {
                return this.videoTracks;
            };
        }
        if (!webkitMediaStream.prototype.getAudioTracks) {
            webkitMediaStream.prototype.getAudioTracks = function () {
                return this.audioTracks;
            };
        }
    }
    // Detect IE/Safari
    else if (RTCBrowserType.isTemasysPluginUsed()) {

        //AdapterJS.WebRTCPlugin.setLogLevel(
        //    AdapterJS.WebRTCPlugin.PLUGIN_LOG_LEVELS.VERBOSE);

        AdapterJS.webRTCReady(function (isPlugin) {

            self.peerconnection = RTCPeerConnection;
            self.getUserMedia = getUserMedia;
            self.attachMediaStream = function (elSel, stream) {

                if (stream.id === "dummyAudio" || stream.id === "dummyVideo") {
                    return;
                }

                attachMediaStream(elSel[0], stream);
            };
            self.getStreamID = function (stream) {
                var id = APP.xmpp.filter_special_chars(stream.label);
                return id;
            };
            self.getVideoSrc = function (element) {
                if (!element) {
                    console.warn("Attempt to get video SRC of null element");
                    return null;
                }
                var children = element.children;
                for (var i = 0; i !== children.length; ++i) {
                    if (children[i].name === 'streamId') {
                        return children[i].value;
                    }
                }
                //console.info(element.id + " SRC: " + src);
                return null;
            };
            self.setVideoSrc = function (element, src) {
                //console.info("Set video src: ", element, src);
                if (!src) {
                    console.warn("Not attaching video stream, 'src' is null");
                    return;
                }
                AdapterJS.WebRTCPlugin.WaitForPluginReady();
                var stream = AdapterJS.WebRTCPlugin.plugin
                    .getStreamWithId(AdapterJS.WebRTCPlugin.pageId, src);
                attachMediaStream(element, stream);
            };

            onTemasysPluginReady(isPlugin);
        });
    } else {
        try {
            console.log('Browser does not appear to be WebRTC-capable');
        } catch (e) { }
        window.location.href = 'unsupported_browser.html';
    }
}


RTCUtils.prototype.getUserMediaWithConstraints = function(
    um, success_callback, failure_callback, resolution,bandwidth, fps,
    desktopStream) {
    console.log("RTCUtils.prototype.getUserMediaWithConstraints");
    currentResolution = resolution;

    var constraints = getConstraints(
        um, resolution, bandwidth, fps, desktopStream);

    console.info("Get media constraints", constraints);

    var self = this;

    try {
        this.getUserMedia(constraints,
            function (stream) {
                console.log('onUserMediaSuccess');
                self.setAvailableDevices(um, true);
                success_callback(stream);
                console.log("APP.RTC.localVideo.stream id in getconstraints::",APP.RTC.localVideo.stream.id);
            },
            function (error) {
                self.setAvailableDevices(um, false);
                console.warn('Failed to get access to local media. Error ',
                    error, constraints);
                if (failure_callback) {
                    failure_callback(error);
                }
            });
    } catch (e) {
        console.error('GUM failed: ', e);
        if(failure_callback) {
            failure_callback(e);
        }
    }
};

RTCUtils.prototype.setAvailableDevices = function (um, available) {
    var devices = {};
    if(um.indexOf("video") != -1) {
        devices.video = available;
    }
    if(um.indexOf("audio") != -1) {
        devices.audio = available;
    }
    this.service.setDeviceAvailability(devices);
};

/**
 * We ask for audio and video combined stream in order to get permissions and
 * not to ask twice.
 */
RTCUtils.prototype.obtainAudioAndVideoPermissions =
    function(devices, callback, usageOptions)
{
console.log("RTCUtils.prototype.obtainAudioAndVideoPermissions");
    var self = this;
    // Get AV

    var successCallback = function (stream) {
        if(callback)
            callback(stream, usageOptions);
        else
            self.successCallback(stream, usageOptions);
    };

    if(!devices)
        devices = ['audio', 'video'];

    var newDevices = [];


    if(usageOptions)
        for(var i = 0; i < devices.length; i++) {
            var device = devices[i];
            if(usageOptions[device] === true)
                newDevices.push(device);
        }
    else
        newDevices = devices;

    if(newDevices.length === 0) {
        successCallback();
        return;
    }

    if (RTCBrowserType.isFirefox() || RTCBrowserType.isTemasysPluginUsed()) {

        // With FF/IE we can't split the stream into audio and video because FF
        // doesn't support media stream constructors. So, we need to get the
        // audio stream separately from the video stream using two distinct GUM
        // calls. Not very user friendly :-( but we don't have many other
        // options neither.
        //
        // Note that we pack those 2 streams in a single object and pass it to
        // the successCallback method.
        var obtainVideo = function (audioStream) {
            self.getUserMediaWithConstraints(
                ['video'],
                function (videoStream) {
                    return successCallback({
                        audioStream: audioStream,
                        videoStream: videoStream
                    });
                },
                function (error) {
                    console.error(
                        'failed to obtain video stream - stop', error);
                    self.errorCallback(error);
                },
                config.resolution || '360');
        };
        var obtainAudio = function () {
            self.getUserMediaWithConstraints(
                ['audio'],
                function (audioStream) {
                    if (newDevices.indexOf('video') !== -1)
                        obtainVideo(audioStream);
                },
                function (error) {
                    console.error(
                        'failed to obtain audio stream - stop', error);
                    self.errorCallback(error);
                }
            );
        };
        if (newDevices.indexOf('audio') !== -1) {
            obtainAudio();
        } else {
            obtainVideo(null);
        }
    } else {
        this.getUserMediaWithConstraints(
        newDevices,
        function (stream) {
            successCallback(stream);
        },
        function (error) {
            self.errorCallback(error);
        },
        config.resolution || '360');
    }
};

RTCUtils.prototype.successCallback = function (stream, usageOptions) {
    // If this is FF or IE, the stream parameter is *not* a MediaStream object,
    // it's an object with two properties: audioStream, videoStream.
    console.log("stream::",stream);
    if (stream && stream.getAudioTracks && stream.getVideoTracks)
        console.log('got', stream, stream.getAudioTracks().length,
            stream.getVideoTracks().length);
    this.handleLocalStream(stream, usageOptions);
    if(cameraSwitched){
    	cameraSwitched = false;
    	//this.peerConnection.addStream(stream);
		//sess.doSwitch();
		
		//APP.RTC.doSwitch(stream);
		//var newstream = this.createStream(stream, true);
		//APP.xmpp.createStream(stream);
		//Aruna
		//stream, oldStream, callback, isAudio
		videoTrack = APP.RTC.localVideo.getTracks()[0];
    	APP.xmpp.addStream(videoTrack);
		APP.xmpp.addStream(APP.RTC.localVideo.stream);
     
		console.log("APP.RTC.localVideo.stream.id::",stream,APP.RTC);
		//APP.xmpp.switchStreams();
		//APP.xmpp.addStream(stream);
		//APP.RTC.attachMediaStream(element,stream);
        //localVideo = $('#' + localVideo.id)[0];
        //localVideoContainer.removeChild(localVideo);
        //self.VideoLayout.updateRemovedVideo(APP.xmpp.myResource());
		
		//APP.RTC.localVideo.stream.start();
		//APP.RTC.localVideo.stream.stop();
		//APP.xmpp.onaddStream(stream);
		//eventEmitter.emit(StreamEventTypes.EVENT_TYPE_REMOTE_CHANGED,doSwitch);
    }
};

RTCUtils.prototype.errorCallback = function (error) {
    var self = this;
    console.error('failed to obtain audio/video stream - trying audio only', error);
    var resolution = getPreviousResolution(currentResolution);
    if(typeof error == "object" && error.constraintName && error.name
        && (error.name == "ConstraintNotSatisfiedError" ||
            error.name == "OverconstrainedError") &&
        (error.constraintName == "minWidth" || error.constraintName == "maxWidth" ||
            error.constraintName == "minHeight" || error.constraintName == "maxHeight")
        && resolution != null)
    {
        self.getUserMediaWithConstraints(['audio', 'video'],
            function (stream) {
                return self.successCallback(stream);
            }, function (error) {
                return self.errorCallback(error);
            }, resolution);
    }
    else {
        self.getUserMediaWithConstraints(
            ['audio'],
            function (stream) {
                return self.successCallback(stream);
            },
            function (error) {
                console.error('failed to obtain audio/video stream - stop',
                    error);
                return self.successCallback(null);
            }
        );
    }
};

RTCUtils.prototype.handleLocalStream = function(stream, usageOptions) {
    // If this is FF, the stream parameter is *not* a MediaStream object, it's
    // an object with two properties: audioStream, videoStream.
    var audioStream, videoStream;
    if(window.webkitMediaStream)
    {
        audioStream = new webkitMediaStream();
        videoStream = new webkitMediaStream();
        if(stream) {
            var audioTracks = stream.getAudioTracks();

            for (var i = 0; i < audioTracks.length; i++) {
                audioStream.addTrack(audioTracks[i]);
            }

            var videoTracks = stream.getVideoTracks();

            for (i = 0; i < videoTracks.length; i++) {
                videoStream.addTrack(videoTracks[i]);
            }
        }
    }
    else if (RTCBrowserType.isFirefox() || RTCBrowserType.isTemasysPluginUsed())
    {   // Firefox and Temasys plugin
        if (stream && stream.audioStream)
            audioStream = stream.audioStream;
        else
            audioStream = new DummyMediaStream("dummyAudio");

        if (stream && stream.videoStream)
            videoStream = stream.videoStream;
        else
            videoStream = new DummyMediaStream("dummyVideo");
    }

    var audioMuted = (usageOptions && usageOptions.audio === false),
        videoMuted = (usageOptions && usageOptions.video === false);

    var audioGUM = (!usageOptions || usageOptions.audio !== false),
        videoGUM = (!usageOptions || usageOptions.video !== false);


    this.service.createLocalStream(audioStream, "audio", null, null,
        audioMuted, audioGUM);

    this.service.createLocalStream(videoStream, "video", null, 'camera',
        videoMuted, videoGUM);
};

function DummyMediaStream(id) {
    this.id = id;
    this.label = id;
    this.stop = function() { };
    this.getAudioTracks = function() { return []; };
    this.getVideoTracks = function() { return []; };
}

RTCUtils.prototype.createStream = function(stream, isVideo) {
    var newStream = null;
    if (window.webkitMediaStream) {
        newStream = new webkitMediaStream();
        if (newStream) {
            var tracks = (isVideo ? stream.getVideoTracks() : stream.getAudioTracks());

            for (var i = 0; i < tracks.length; i++) {
                newStream.addTrack(tracks[i]);
            }
        }

    }
    else {
        // FIXME: this is duplicated with 'handleLocalStream' !!!
        if (stream) {
            newStream = stream;
        } else {
            newStream =
                new DummyMediaStream(isVideo ? "dummyVideo" : "dummyAudio");
        }
    }

    return newStream;
};

module.exports = RTCUtils;
