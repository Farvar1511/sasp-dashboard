import { Label } from "recharts";

const links = [
  { Label: 'San Andreas State Police S.O.P.', Url: 'https://docs.google.com/document/d/1lR9fnzKmrky4Pbiu_sejJfyGcDIinga5VHJxgC-a34E/edit?tab=t.0', Category: 'Standard Operating Procedures' },
  { Label: 'H.E.A.T.', Url: 'https://docs.google.com/document/u/0/d/1KzLKx02HBSvozRu5wEcZ0gg74cJzd7i3mPh2SfSRBHE/edit', Category: 'Standard Operating Procedures' },
  { Label: 'MOTO', Url: 'https://docs.google.com/document/u/0/d/1kfqQ1eoLoFwQa4GHR4VO2FiDVsbCleVLogRKsSl5_Aw/edit', Category: 'Standard Operating Procedures' },
  { Label: 'Air and Coastal Unit', Url: 'https://docs.google.com/document/d/1LTW49OscZ18mLJfcd5sQSp3mm78pJNRyxBuSdDQHU7A/edit?usp=sharing', Category: 'Standard Operating Procedures' },
  { Label: 'Special Weapons And Tactics', Url: 'https://docs.google.com/document/d/e/2PACX-1vTSChd7RIk5f94UmfDlp8nsKU2PkvlZES9BGtQPArdqNUG1cV_gX2JtFqy5adjD66Q8fgRHT2NDetLx/pub', Category: 'Standard Operating Procedures' },
  { Label: 'K9 Officer', Url: 'https://docs.google.com/document/d/1El_Vf8uIXNDS-Zgvd0z1U2mQ27v7RiamIuKNe8uV-TE/edit?tab=t.0', Category: 'Standard Operating Procedures' },
  { Label: 'EMS Reference Sheet', Url: 'https://www.everfallcommunity.com/emergency-reference', Category: 'Training' },
  { Label: 'Field Training Guide', Url: 'https://docs.google.com/document/d/1Ou9UIKCsM3Ji4AB60jgMx8T9RHr9BC4-aLIW6ZlNPkU/edit?usp=sharing', Category: 'Training' },
  { Label: 'BLS Cheat Sheet', Url: 'https://docs.google.com/document/d/1seHQIbAZt0XpIvyRsBxY7L3Cr_WKxWhkj-b2mIvuC9g/edit?tab=t.0', Category: 'Training' },
  { Label: 'Cadet Classroom Slideshow', Url: 'https://docs.google.com/presentation/d/1t-RG80mmjcBc39PsJzK5drIUH_JJgp1u1n17kSHaV5I/edit?usp=sharing', Category: 'Training' },
  { Label: 'Cadet Training Ticket Form', Url: 'https://script.google.com/macros/s/AKfycbx87Ip5AiS5u_o1Z84CZtoq7ERB51saV0wMnTlbiWgogU3rHaKuv4MgqaQgcdWBLEIc/exec', Category: 'Training' },
  { Label: 'Cadet Feedback Form', Url: 'https://script.google.com/macros/s/AKfycbwzdHPhslEarCo2wXGKsk3WYNtwVXn6JmqiJyiN1mwo1XUVJT-qatZ3kUIiE7Fu2qAHfA/exec', Category: 'Training' },
  { Label: 'LIDAR Gun User Manual', Url: 'https://docs.luxartengineering.com/pro-laser-4/in-game-use-guide', Category: 'Training' },
  { Label: 'WRAITH ARS 2X Manual', Url: 'https://drive.google.com/uc?export=download&id=1_JMfVk1cZQB9mTjuZms1e3B2mXed9yC-', Category: 'Training' },
  { Label: 'Civilian Phone Registry', Url: 'https://docs.google.com/spreadsheets/d/1TieBmH6bEqC0QoFbLrb5E6NwrQ1bB4QZYjrWD1dGHEQ/edit?gid=0#gid=0', Category: 'Resources' },
  { Label: 'MDT Gang Notices', Url: 'https://docs.google.com/document/d/1SgUUtPQWhnltF9ixR3XxD48EaKvohHXV2KYK1JmXCd4/edit?usp=sharing', Category: 'Resources' },
  { Label: 'Plate Tracker', Url: 'https://docs.google.com/spreadsheets/d/1CAosEhFWk7-py-c3laL4DAyER34M7-BJ5DBjJaZ7rLI/edit?gid=0#gid=0', Category: 'Resources' },
  { Label: 'Arrest Warrant Template', Url: 'https://docs.google.com/document/d/1Tq0PXaJEEMg3umPHSpTzbaaKiq-tTpHv1QOBBdo6yoc/edit?usp=sharing', Category: 'Department of Justice' },
  { Label: 'Search Warrant Template', Url: 'https://docs.google.com/document/d/1Tm6dSQ8bOV1z9handPYcqBOIuTAgQQTlw-Zc2qLOweM/edit?usp=sharing', Category: 'Department of Justice' },
  { Label: 'Penal Codes', Url: 'https://www.everfallcommunity.com/penalcode', Category: 'Department of Justice' },
  { Label: 'Case Law', Url: 'https://docs.google.com/document/d/1PGWz8yW8U2hvUMBq3aTUa3gu8WSJlilushztSyctUM8/edit?tab=t.0', Category: 'Department of Justice' },
  { Label: 'Bail Process', Url: 'https://docs.google.com/document/d/e/2PACX-1vSoUiYAA6zKbumFQ1cFr0jc5Tiu8lVhq0gHwu4XohpFUmoLSmN6tv_AP70thP47Y1vnS2yzQUlQZU-1/pub', Category: 'Department of Justice' },
  { Label: 'File A Warrant', Url: 'https://discord.com/channels/1045125896081788928/1114331045748289557/1199569024464457898', Category: 'Department of Justice' },
  { Label: 'Video Footage Guidelines', Url: 'https://docs.google.com/document/d/1bfGLiCfNrZZM0GqSphsswD51kj6uMeM5ofh4v8gerR8/edit?usp=sharing', Category: 'Department of Justice' },
  { Label: 'SASP Roster', Url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQY_reY_QNw_faOG9LvgJm0TiDujgCxXD3KXQQ37e6PMY44E9aRIQ_g-tUThtvnJQ1LHzSrZHuQRYyw/pubhtml?gid=1777737199', Category: 'Resources' },
  { Label: 'Fleet Management', Url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBCfEXdC6jygMC25n1545ZZiNcWwzljaI09-1lqZjd5AHJrRoX38ecyDuZk_GMipcGpXkkuMF3XYR8/pubhtml?gid=0', Category: 'Resources' },
  { Label: 'CIU SOP', Url: 'https://docs.google.com/document/d/1vCS79Cj_fpSWWWYUU3ShQ9NNs4EaNmxgZ-BckEHJhGI/edit?usp=sharing', Category: 'Standard Operating Procedures' },
];

export default links;
