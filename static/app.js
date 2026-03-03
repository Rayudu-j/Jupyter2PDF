// 1. Handle File Upload & Notebook Rendering
document.getElementById('upload-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('file-input');

    if (!fileInput.files.length) {
        alert('Please select a .ipynb file first.');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            const container = document.getElementById('notebook-container');
            container.innerHTML = ''; // Clear existing

            // We need to chunk the incoming HTML into visual pages. 
            // The simplest robust approach for a complex notebook HTML is to render it into a hidden div,
            // measure heights, and slice it into A4 pages.
            // For now, we will wrap the *entire* parsed body in a single notebook-page 
            // but rely on CSS page-break properties to guide the PDF engine, 
            // while making the container look like a contiguous continuous scroll of paper.

            const page = document.createElement('div');
            page.className = 'notebook-page';
            page.style.minHeight = '11in';
            page.style.height = 'auto'; // allow it to grow
            page.innerHTML = data.html;

            container.appendChild(page);

            // Wait for images/math to load before calculating drag bounds
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 500);

        } else {
            alert(data.error || 'Error processing notebook.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to connect to the backend. Is Flask running?');
    }
});

// 2. Add Draggable & Editable Text Box
document.getElementById('add-text-btn').addEventListener('click', () => {
    // Create new div
    const textBox = document.createElement('div');
    textBox.classList.add('draggable-text');
    textBox.contentEditable = "true";
    textBox.innerText = 'Click to edit, drag to move';

    // Set initial position: center of the current viewport
    const initialX = window.innerWidth / 2 - 60 + window.scrollX;
    const initialY = window.innerHeight / 3 + window.scrollY;

    textBox.style.transform = `translate(${initialX}px, ${initialY}px)`;
    textBox.setAttribute('data-x', initialX);
    textBox.setAttribute('data-y', initialY);

    // Prevent drag movement when actively editing text
    textBox.addEventListener('mousedown', (e) => {
        if (document.activeElement === textBox) {
            e.stopPropagation();
        }
    });

    document.body.appendChild(textBox);

    // Initialize interact.js on this element
    makeDraggable(textBox);
});

// interact.js movement logic
function makeDraggable(element) {
    interact(element).draggable({
        inertia: true,
        modifiers: [
            interact.modifiers.restrictRect({
                restriction: 'document',
                endOnly: true
            })
        ],
        autoScroll: true,
        listeners: {
            move: (event) => {
                const target = event.target;
                const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                target.style.transform = `translate(${x}px, ${y}px)`;
                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);
            },
        }
    });
}

// 3. Export to PDF
document.getElementById('download-btn').addEventListener('click', () => {
    const pages = document.querySelectorAll('.notebook-page');
    if (pages.length === 0) return;

    // Get input values and constants
    const userName = document.getElementById('input-name').value || ' ';

    // Fetch the roll number from the input field
    const rollNoInput = document.getElementById('input-roll').value.trim();
    // Keep the fallback for the PDF header
    const rollNo = rollNoInput || 'Unknown Roll No';

    const section = document.getElementById('input-section').value || 'Unknown Section';
    const labName = document.getElementById('input-lab').value || 'Unknown Lab';

    // Create the dynamic filename based on the user's roll number input
    const dynamicFilename = rollNoInput ? `${rollNoInput}_ML_Lab.pdf` : 'ML_Lab_Submission.pdf';

    const containerToPrint = pages[0];
    const containerRect = containerToPrint.getBoundingClientRect();

    const opt = {
        margin: [0.7, 0.5, 0.7, 0.5], // Top, Left, Bottom, Right margins in inches. Added top/bottom padding for headers/footers
        filename: dynamicFilename,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: -window.scrollY // VERY IMPORTANT: Adjusts for current scroll position
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    const textboxes = document.querySelectorAll('.draggable-text');

    textboxes.forEach(box => {
        const x = parseFloat(box.getAttribute('data-x')) || 0;
        const y = parseFloat(box.getAttribute('data-y')) || 0;

        const boxRect = box.getBoundingClientRect();

        box.style.transform = 'none';

        // Append to the print container temporarily
        containerToPrint.appendChild(box);

        // Absolute position within the print container
        const absBoxY = boxRect.top + window.scrollY;
        const absContainerY = containerRect.top + window.scrollY;

        const absBoxX = boxRect.left + window.scrollX;
        const absContainerX = containerRect.left + window.scrollX;

        box.style.left = `${absBoxX - absContainerX}px`;
        box.style.top = `${absBoxY - absContainerY}px`;

        // Style for PDF (ensure they render over everything)
        box.style.border = '1px solid transparent';
        box.style.background = 'rgba(253, 224, 71, 1)';
    });

    // Execute standard html2pdf promise flow with a hook for jsPDF
    // Execute standard html2pdf promise flow with a hook for jsPDF
    html2pdf().from(containerToPrint).set(opt).toPdf().get('pdf').then((pdf) => {
        // This block runs AFTER the HTML is rendered to canvas but BEFORE it saves.
        const totalPages = pdf.internal.getNumberOfPages();

        // Loop through all pages to inject Header & Footer
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);

            // Set Font properties
            pdf.setFontSize(10);
            pdf.setTextColor(100); // Gray text

            // HEADER: Top Right
            pdf.text(`Name: ${userName}`, 6.0, 0.4);
            pdf.text(`Roll No: ${rollNo}`, 6.0, 0.55);

            // FOOTER: Bottom Right
            pdf.text(`Section: ${section}`, 6.0, 10.45);
            pdf.text(`Lab: ${labName}`, 6.0, 10.6);
        }

    }).save().then(() => {
        // Clean up UI / Restore state after PDF downloads
        textboxes.forEach(box => {
            const x = parseFloat(box.getAttribute('data-x')) || 0;
            const y = parseFloat(box.getAttribute('data-y')) || 0;

            box.style.transform = `translate(${x}px, ${y}px)`;
            box.style.left = 'auto';
            box.style.top = 'auto';
            box.style.border = '2px dashed #eab308';
            box.style.background = 'rgba(253, 224, 71, 0.9)';

            document.body.appendChild(box);
        });
    });
});
