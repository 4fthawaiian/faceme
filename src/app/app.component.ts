import {AfterViewInit, Component, OnInit, ViewChild, ElementRef} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {AsyncPipe, NgForOf, NgIf} from "@angular/common";
import {MatFormField, MatOption, MatSelect, MatLabel} from "@angular/material/select";
import {FormsModule} from "@angular/forms";
import {MatButton} from "@angular/material/button";
import * as faceapi from 'face-api.js';
import {MatIcon} from "@angular/material/icon";
import { MatTooltipModule } from '@angular/material/tooltip';
import {AsyncClickDirective} from "ngx-async-click";
import {SpinnerComponent} from "./spinner/spinner.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgForOf, MatSelect, MatOption, FormsModule, MatFormField, MatButton, AsyncPipe, MatIcon, MatTooltipModule, MatLabel, AsyncClickDirective, SpinnerComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, AfterViewInit {
  message: string;
  age: number;
  gender: string;
  ageProb: number;
  title = 'faceme';
  faces = ['brad.jpg','nick.jpg','kerri.jpg']
  mediaStream: MediaStream;
  selectedFace: string = '';
  detectInterval: any;
  detected: boolean = false;
  detecting: boolean = false;
  matched: boolean = false;
  chosen: boolean = false;
  videoDimensions: {w: number, h: number} = {w: 0, h: 0};
  photoCanvas: HTMLCanvasElement;
  canvasHolder: any;

  @ViewChild('faceHolder') faceHolder: ElementRef<HTMLImageElement>;
  @ViewChild('video') videoElement: ElementRef<HTMLVideoElement>;
  @ViewChild('faceSelector') faceSelector: MatSelect;
  @ViewChild('photo') photoElement: ElementRef<HTMLImageElement>;
  @ViewChild('facesDisplay') facesDisplay: ElementRef<HTMLDivElement>;
  @ViewChild('nomatch') nomatch: MatIcon;


  ngAfterViewInit() {}

  async ngOnInit() {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
    ]);
    this.faceSelector.valueChange.subscribe(async (face) => {
      await this.chooseFace(face)
    });
    // this.videoElement.nativeElement.onplay = (e) => {
    //   console.log(e.target);
    //   let settings = display.getVideoTracks()[0]
    //     .getSettings();
    //
    //   let width = settings.width;
    //   let height = settings.height;
    // }
    this.photoCanvas.setAttribute('hidden', 'true');
    this.canvasHolder = document.body.append(this.photoCanvas);
  }
  async chooseFace (face: string = '') {
    if(face === "") face = this.selectedFace;
    this.faceHolder.nativeElement.src = `/faces/${face}`
    this.photoElement.nativeElement.src = `/spacer.gif`
    this.selectedFace = face;
    this.detecting = true;
    await this.startVideo();
  }
  checkFace(): void {
    if(this.selectedFace == "") return;
  }
  async startVideo () {
    this.detecting = true;
    this.detected = false;
    let that = this;
    let videoOptions = {
        width: { min: 640, ideal: window.innerWidth, max: 1920 },
        height: { min: 480, ideal: window.innerHeight, max: 1080 }
      };
    let stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoOptions });
    if(that.mediaStream?.getVideoTracks()[0] && that.chosen && that.mediaStream.getVideoTracks()[0].readyState && that.mediaStream.getVideoTracks()[0].readyState == "ended"){
      that.mediaStream.getVideoTracks().forEach((a,i) => {
        that.mediaStream.removeTrack(that.mediaStream.getVideoTracks()[i])
      })
      stream.getTracks().forEach(b => {
        that.mediaStream.addTrack(b);
      })
    } else {
      that.mediaStream = stream;
    }
    var width = stream.getVideoTracks()[0].getSettings().width || 0;
    var height = stream.getVideoTracks()[0].getSettings().height || 0;
    this.videoDimensions = {w: width, h: height};
    that.videoElement.nativeElement.srcObject = stream;
    that.videoElement.nativeElement.play();
    that.chosen = true;
    await that.runDetection();
  }
  takePicture(): void {
    this.photoCanvas = faceapi.createCanvas({ width: this.videoDimensions.w, height: this.videoDimensions.h });
    const displaySize = { width: this.videoDimensions.w, height: this.videoDimensions.h };
    faceapi.matchDimensions(this.photoCanvas, displaySize);
    const context = this.photoCanvas.getContext("2d");
    context?.drawImage(this.videoElement.nativeElement, 0, 0, this.videoDimensions.w, this.videoDimensions.h);
    const data = this.photoCanvas.toDataURL("image/png");
    this.photoElement.nativeElement.setAttribute("src", data);
  }
  async runDetection() {
    this.matched = false;
    const that = this;
    this.detecting = true;
    this.detectInterval = setInterval(async (referenceImg: any, userImg: any) => {

      const detection = await faceapi
        // .detectSingleFace(this.video.nativeElement, new faceapi.TinyFaceDetectorOptions({
        //   scoreThreshold: 0.7
        .detectSingleFace(this.videoElement.nativeElement, new faceapi.SsdMobilenetv1Options({
          minConfidence: 0.9
        }))
      if(detection) {
        that.takePicture();
        that.mediaStream.getTracks()[0].stop();
        clearInterval(that.detectInterval);
        that.detected = true;
        this.detecting = false;
        await that.compareFaces(that.faceHolder, that.photoElement, detection);
      }

    }, 500);
  }
  async compareFaces(referenceImg: any, userImg: any, detection: any) {
    const referenceDetection = await faceapi
      .detectSingleFace(referenceImg.nativeElement, new faceapi.SsdMobilenetv1Options({
        minConfidence: 0.9
      }))

    const userFaces = await faceapi.extractFaces(userImg.nativeElement, [detection]);
    const userFace = userFaces[userFaces.length - 1];

    const refFaces = await faceapi.extractFaces(referenceImg.nativeElement, [referenceDetection as faceapi.FaceDetection]);
    const refFace = refFaces[refFaces.length - 1];

    this.facesDisplay.nativeElement.innerHTML = "";
    this.facesDisplay.nativeElement
      .append(userFace);
    this.facesDisplay.nativeElement
      .append(refFace);

    faceapi.computeFaceDescriptor(refFace).then(referenceDescriptor => {
      const reference = referenceDescriptor as Float32Array;
      faceapi.computeFaceDescriptor(userFace).then(userDescriptor => {
        const user = userDescriptor as Float32Array;
        const distance = faceapi.euclideanDistance(reference, user);
        if (distance < 0.39) {
          // Authenticate user
          this.matched = true;
        } else {
          // Authentication failed
          this.matched = false;
        }
        console.log(distance);
      });
    });
  }
}
