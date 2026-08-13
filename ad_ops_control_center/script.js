const app = {
    currentLab: null,
    currentStep: 1,

    init() {
        console.log("Vibetube Ads Lab Walkthrough Initialized");
    },

    openLab(labId) {
        if(labId === 'lab-1') {
            document.getElementById('view-home').classList.remove('active');
            document.getElementById('view-lab-1').classList.add('active');
            this.currentLab = 'lab-1';
            this.goToStep(1);
        }
    },

    goHome() {
        document.getElementById('view-lab-1').classList.remove('active');
        document.getElementById('view-home').classList.add('active');
        this.currentLab = null;
    },

    goToStep(stepNumber) {
        // Update Step Content
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-content-${stepNumber}`).classList.add('active');
        
        // Update Sidebar
        document.querySelectorAll('.step-item').forEach(el => {
            const step = parseInt(el.getAttribute('data-step'));
            el.classList.remove('active');
            if(step < stepNumber) {
                el.classList.add('completed');
            } else {
                el.classList.remove('completed');
            }
            if(step === stepNumber) {
                el.classList.add('active');
            }
        });
        
        this.currentStep = stepNumber;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    mockGenerateCreative() {
        const btn = document.querySelector('#step-content-2 .action-btn');
        btn.innerText = "Generating with Gemini...";
        btn.disabled = true;
        btn.style.opacity = '0.7';
        
        setTimeout(() => {
            btn.innerText = "Creative Generated!";
            btn.style.backgroundColor = 'var(--success-color)';
            document.getElementById('creative-result').classList.remove('hidden');
        }, 1500);
    },

    mockRunBaseline() {
        const btn = document.querySelector('#step-content-3 .action-btn');
        btn.innerText = "Simulating...";
        btn.disabled = true;
        btn.style.opacity = '0.7';

        setTimeout(() => {
            btn.innerText = "Run Baseline Simulation (20 Auctions)";
            btn.disabled = false;
            btn.style.opacity = '1';
            document.getElementById('baseline-result').classList.remove('hidden');
        }, 1200);
    },

    mockRunAgent() {
        const btn = document.querySelector('#step-content-4 .action-btn') || document.querySelector('#step-content-5 .action-btn');
        if(btn) {
            btn.innerText = "Simulating with Agent...";
            btn.disabled = true;
            btn.style.opacity = '0.7';

            setTimeout(() => {
                btn.innerText = "Run Agent Simulation (20 Auctions)";
                btn.disabled = false;
                btn.style.opacity = '1';
                document.getElementById('agent-result').classList.remove('hidden');
            }, 1200);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
