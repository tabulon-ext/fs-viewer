import "./stage.sass";
import * as React from "react";
import {Center} from "./center";

interface Props {
    files: FilesView;
    fileIndex: number;
    preload: number;
    transitionInterval: number;
    focusTime: number;
    showActualSize: boolean;
    onSetFileIndex: (index: number) => void;
}

interface State {
    dragging?: boolean;
    fileType?: string;
}

const videoFileSuffices = new Set(["avi", "mkv", "mp4", "mov", "webm"]);

function loadImage(files: FilesView, index: number): HTMLImageElement {
    var image = document.createElement("img");
    image.src = `file://${files.path}/${files.names[index]}`;
    return image;
}

export class Stage extends React.PureComponent<Props, State> {
    preloadedImages: Array<HTMLImageElement> = [];

    private container: React.RefObject<HTMLElement>;

    private probeRequestController?: AbortController;

    private transitionTimer?: number;

    constructor(props: Props, context: any) {
        super(props, context);

        this.state = {};

        this.container = React.createRef<HTMLElement>();

        this.handleDisableButtons = this.handleDisableButtons.bind(this);
        this.handleImageError = this.handleImageError.bind(this);
        this.handleKeyDownShell = this.handleKeyDownShell.bind(this);
        this.navigateNext = this.navigateNext.bind(this);
        this.navigatePrev = this.navigatePrev.bind(this);

        this.componentDidMount = this.ensureFocus.bind(this);
    }

    private ensureFocus(): void {
        if (this.container.current)
            this.container.current.focus();
    }

    componentDidUpdate(p: Props): void {
        let {fileIndex, files, preload, transitionInterval} = this.props;
        if (p.fileIndex != fileIndex) {
            if (this.probeRequestController) {
                this.probeRequestController.abort();
                delete this.probeRequestController;
            }

            if (preload > 0) {
                ++preload;
    
                const preloaded: Array<HTMLImageElement> = [];
    
                let n = Math.min(files.names.length, fileIndex + preload);
                while (--n > fileIndex)
                    preloaded.push(loadImage(files, n));
    
                n = Math.max(-1, fileIndex - preload);
                while (++n < fileIndex)
                    preloaded.push(loadImage(files, n));
    
                this.preloadedImages = preloaded;
            }
        }

        if (p.transitionInterval !== transitionInterval) {
            if (this.transitionTimer)
                clearInterval(this.transitionTimer);

            if (transitionInterval === 0) {
                delete this.transitionTimer;
            } else {
                this.transitionTimer = window.setInterval(
                    () => this.navigateNext(),
                    transitionInterval);
            }
        }

        if (p.focusTime !== this.props.focusTime)
            this.ensureFocus();
    }

    render() {
        const {files, fileIndex, showActualSize} = this.props;
        const {dragging, fileType} = this.state;
        const fileName = files.names[fileIndex];

        const suffixIndex = fileName.lastIndexOf('.');
        let isVideo = false;
        if (suffixIndex > 0) {
            isVideo = videoFileSuffices.has(fileName.slice(suffixIndex + 1));
        } else if (fileType) {
            isVideo = fileType.startsWith("video/");
        }

        const fileUrl = `file://${files.path}/${fileName}`;
        const cssClass = showActualSize ? "stage" : "stage fit";

        return <section className={cssClass}
            tabIndex={0}
            ref={this.container}
            onKeyDown={this.handleKeyDownShell}
        >
            <Center key={fileName} onDrag={this.handleDisableButtons}>
                {isVideo
                    ? <video src={fileUrl} controls />
                    : <img src={fileUrl}
                        alt={fileName}
                        onError={this.handleImageError} />}
            </Center>
            <button disabled={dragging || fileIndex <= 0}
                onClick={this.navigatePrev}
            />
            <button disabled={dragging || fileIndex >= files.names.length - 1}
                onClick={this.navigateNext}
            />
        </section>;
    }

    navigateNext(): void {
        const {fileIndex, files, onSetFileIndex} = this.props;
        fileIndex < files.names.length - 1 && onSetFileIndex(fileIndex + 1);
    }

    navigatePrev(): void {
        const {fileIndex, onSetFileIndex} = this.props;
        fileIndex > 0 && onSetFileIndex(fileIndex - 1);
    }

    handleDisableButtons(dragging: boolean): void {
        this.setState({dragging});
    }

    handleImageError(): void {
        const {files, fileIndex} = this.props;

        this.probeRequestController = new AbortController();
        const url = `file://${files.path}/${files.names[fileIndex]}`;
        fetch(url, {
            method: "HEAD",
            cache: "default",
            redirect: "follow",
            signal: this.probeRequestController.signal,
        })
        .then(r => {
            if (url === r.url) {
                const fileType = r.headers.get("Content-Type");
                fileType && this.setState({fileType});
            }
        })
        .finally(() => delete this.probeRequestController);
    }

    handleKeyDownShell(ev: React.KeyboardEvent): void {
        switch (ev.key) {
        case "ArrowRight":
            this.navigateNext();
            break;

        case "ArrowLeft":
            this.navigatePrev();
            break;
        }
    }
}