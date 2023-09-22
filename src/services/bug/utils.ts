export const generateEmail = ({ name, email, details }) => `
<p>Dear Graasp Team,</p>

<p>I hope this email finds you well. I wanted to bring to your attention a bug that I've encountered while using Graasp. I believe it's important to report this issue to help improve the overall user experience.</p>
<strong>Bug Details:</strong>
<ul>
    <li><strong>Reporter Name:</strong> ${name}</li>
    <li><strong>Reporter Email:</strong> ${email}</li>
    <li><strong>Details:</strong> ${details}</li>
</ul>
<p>I believe that addressing this bug will contribute to an enhanced user experience for all users of Graasp. Please connect reporter for any further information or assistance in reproducing the issue.</p>

  `;
