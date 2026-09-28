<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be executed from the command line.\n");
    exit(1);
}

$moodleroot = "/Users/kraus/apache/www/moodle20.com.br-moodle";

$workflow = <<<'YAML'
# Publishing authorization is your claimed listing: the service checks that
# this repository is the listed source of your entry, by permanent repository
# id. camp CI still independently rebuilds and verifies everything from the
# public tag, and a human merges. Prefer holding a token yourself? The
# personal-access-token flow remains supported: templates/author-release-pat.yml.

name: Publish release to camp

on:
  push:
    tags: ["v*"]
  workflow_dispatch: {}   # backfill an old release: run at the existing tag
                          #   gh workflow run camp-release.yml --ref v1.1.0

permissions:
  contents: read
  id-token: write

env:
  CAMP_INDEX_REPO: camp-registry/camp-index  # the camp index repository
  CAMP_PUBLISH_URL: https://publish.camp-registry.org/publish
  # Both values below are optional overrides — with them empty
  # (recommended), everything is read from your version.php at the tag:
  #   COMPONENT        ← $plugin->component (your frankenstyle name)
  #   SUPPORTED_MOODLE ← the $plugin->supported range when declared,
  #                      else the single branch $plugin->requires maps
  #                      to. Set it only when version.php can't say what
  #                      you mean (e.g. a non-contiguous set "4.1,4.4").
  COMPONENT: ""
  SUPPORTED_MOODLE: ""

jobs:
  publish:
    runs-on: ubuntu-24.04
    steps:
      # Releases are built at immutable tags only; the publish service
      # additionally refuses branch-minted tokens, so this guard just
      # fails earlier with a better message (camp-tools#15).
      - name: Require a tag ref
        run: |
          if [ "${{ github.ref_type }}" != "tag" ]; then
            echo "::error::This workflow must run at a tag. From workflow_dispatch, pick the tag in the ref dropdown (or: gh workflow run camp-release.yml --ref v1.2.3). Current ref: ${{ github.ref_name }} (${{ github.ref_type }})"
            exit 1
          fi
      - name: Check out plugin at the tag
        uses: actions/checkout@v7
        with:
          path: plugin
          fetch-depth: 0

      # Read-only: camp release computes your record against your entry's
      # current ledger. Nothing is pushed from this job.
      - name: Check out camp index
        uses: actions/checkout@v7
        with:
          repository: ${{ env.CAMP_INDEX_REPO }}
          path: index-repo
      - uses: actions/setup-python@v7
        with:
          python-version: "3.12"

      - name: Install camp tools
        run: pip install --quiet "git+https://github.com/camp-registry/camp-tools@v0.2.39"
      - name: Resolve component name
        run: |
          if [ -z "${COMPONENT}" ]; then
            COMPONENT=$(sed -nE 's/.*\$plugin->component[[:space:]]*=[[:space:]]*.?([a-z][a-z0-9_]*).?[[:space:]]*;.*/\1/p' plugin/version.php | head -1)
          fi
          if [ -z "${COMPONENT}" ]; then
            echo "::error::COMPONENT is empty and \$plugin->component was not found in version.php — set one of them"
            exit 1
          fi
          echo "COMPONENT=${COMPONENT}" >> "$GITHUB_ENV"
          echo "component: ${COMPONENT}"
      - name: Require a listing manifest
        run: camp scaffold plugin --check

      - name: Label heuristics + security lint (warn-only preview)
        run: |
          camp lint-labels plugin || true
          camp audit plugin || true
      - name: Compute and append the release record
        run: |
          plugintype="${COMPONENT%%_*}"
          camp release "index-repo/plugins/${plugintype}/${COMPONENT}.yml" \
            "${GITHUB_REF_NAME}" --source ./plugin \
            ${SUPPORTED_MOODLE:+--supported-moodle "${SUPPORTED_MOODLE}"}
      - name: Publish (OIDC token exchange)
        run: |
          CAMP_OIDC_TOKEN=$(curl -sS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=camp-publish" \
            | python3 -c 'import sys,json; print(json.load(sys.stdin)["value"])')
          export CAMP_OIDC_TOKEN TAG="${GITHUB_REF_NAME}"
          python3 <<'EOF'
          import json, os, sys, urllib.request, yaml

          component = os.environ["COMPONENT"]
          tag = os.environ["TAG"]
          path = f"index-repo/plugins/{component.split('_')[0]}/{component}.yml"
          with open(path) as f:
              record = yaml.safe_load(f)["releases"][-1]
          assert record["tag"] == tag, "computed record is not for this tag"

          body = json.dumps({
              "token": os.environ["CAMP_OIDC_TOKEN"],
              "component": component, "tag": tag, "record": record,
          }).encode()
          req = urllib.request.Request(
              os.environ["CAMP_PUBLISH_URL"], data=body,
              headers={"Content-Type": "application/json",
                       "User-Agent": f"camp-release ({component})"})
          try:
              out = json.load(urllib.request.urlopen(req))
          except urllib.error.HTTPError as e:
              raw = e.read().decode(errors="replace")
              try:
                  out = json.loads(raw)
                  msg = f"({out.get('code')}): {out.get('message')}"
              except ValueError:
                  msg = f"HTTP {e.code}: {raw[:200]}"
              print(f"::error::camp publish refused {msg}")
              sys.exit(1)
          print("Release PR:", out["pr"])
          summary = os.environ.get("GITHUB_STEP_SUMMARY")
          if summary:
              with open(summary, "a") as f:
                  f.write(f"Release PR: {out['pr']}\n\n"
                          "camp CI will independently rebuild the artifact "
                          "from the tag and verify the recorded hashes "
                          "before this can merge.\n")
          EOF
YAML;

$plugins = [
    'local_kopere_dashboard' => [
        'path' => 'local/kopere_dashboard',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_kopere_dashboard.

name: "Kopere Dashboard"
summary: "Modern administrative dashboard that makes platform management simpler, faster, and smarter."
description: |
  Modern administrative dashboard that makes platform management simpler, faster, and smarter.

  Benchmark is the act of performing a set of operations in order to evaluate the relative performance of an object, usually running a series of tests and tests on it.

  Supported Moodle versions in the supplied plugin list: 3.11 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-local-kopere_dashboard#readme
  issues: https://github.com/EduardoKrausME/moodle-local-kopere_dashboard/issues
YAML,
    ],
    'theme_boost_magnific' => [
        'path' => 'theme/boost_magnific',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for theme_boost_magnific.

name: "Boost Magnific"
summary: "Modern, highly configurable theme designed to transform the visual experience of courses."
description: |
  Modern, highly configurable theme designed to transform the visual experience of courses.

  With the new dark mode , you can navigate and study in a much more eye-friendly environment, especially in low-light conditions. The feature automatically adapts to your device settings or can be manually enabled through the top menu.

  Supported Moodle versions in the supplied plugin list: 4.0 - 5.0.

labels:
  - fully-free
category: "themes"
links:
  docs: https://github.com/EduardoKrausME/moodle-theme_boost_magnific#readme
  issues: https://github.com/EduardoKrausME/moodle-theme_boost_magnific/issues
YAML,
    ],
    'theme_degrade' => [
        'path' => 'theme/degrade',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for theme_degrade.

name: "Degrade Theme"
summary: "Elegant, responsive, and customizable theme with a distinctive visual identity."
description: |
  Elegant, responsive, and customizable theme with a distinctive visual identity.

  Today I present the modification in Moodle to allow teachers to customize icons. From now on, the teacher can create an activity and choose the icon they want to display on the viewing page. This way, the Moodle™ Software provides the student with a more engaging experience, presenting an icon that precisely reflects the content of the activity.

  Supported Moodle versions in the supplied plugin list: 4.0 - 5.0.

labels:
  - fully-free
category: "themes"
links:
  docs: https://github.com/EduardoKrausME/moodle-theme_degrade#readme
  issues: https://github.com/EduardoKrausME/moodle-theme_degrade/issues
YAML,
    ],
    'mod_supervideo' => [
        'path' => 'mod/supervideo',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for mod_supervideo.

name: "Mod Super Video"
summary: "Advanced video player with controls, integrations, and detailed reports."
description: |
  Advanced video player with controls, integrations, and detailed reports.

  With the aim of providing a more dynamic and customizable teaching experience, I present the Super Video Module, a tool that enhances Moodle's capabilities by allowing easy addition of YouTube, Google Drive, or Vimeo videos.

  Supported Moodle versions in the supplied plugin list: 3.8 - 5.0.

labels:
  - fully-free
category: "video"
links:
  docs: https://github.com/EduardoKrausME/moodle-mod_supervideo#readme
  issues: https://github.com/EduardoKrausME/moodle-mod_supervideo/issues
YAML,
    ],
    'local_geniai' => [
        'path' => 'local/geniai',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_geniai.

name: "GeniAI"
summary: "Artificial intelligence features that support content creation and learning."
description: |
  Artificial intelligence features that support content creation and learning.

  The GeniAI plugin was developed as an extension aimed at enhancing the educational experience in the Moodle online environment. The purpose of this interactive assistant is to support students by clarifying doubts related to both the Moodle platform's functioning and course content, thus promoting effective communication and facilitating autonomous learning.

  Supported Moodle versions in the supplied plugin list: 4.1 - 5.0.

labels:
  - external-account
  - paid-service
category: "integrations"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_geniai#readme
  issues: https://github.com/EduardoKrausME/moodle-local_geniai/issues
YAML,
    ],
    'mod_certificatebeautiful' => [
        'path' => 'mod/certificatebeautiful',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for mod_certificatebeautiful.

name: "Beautiful Certificate"
summary: "Visual editor for creating professional, fully customized certificates."
description: |
  Visual editor for creating professional, fully customized certificates.

  The Certificate Beautiful plugin for Moodle provides an exceptional experience in creating customized certificates, enhancing the aesthetic appeal and professionalism of their designs. With an intuitive and user-friendly interface, this plugin enables Moodle teachers to elevate the recognition and value of certificates issued in their courses.

  Supported Moodle versions in the supplied plugin list: 3.11 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-mod_certificatebeautiful#readme
  issues: https://github.com/EduardoKrausME/moodle-mod_certificatebeautiful/issues
YAML,
    ],
    'local_alternative_file_system' => [
        'path' => 'local/alternative_file_system',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_alternative_file_system.

name: "Alternative File System"
summary: "Store files on external services and optimize the platform infrastructure."
description: |
  Store files on external services and optimize the platform infrastructure.

  Move moodledata/filedir to the cloud and have Moodle serve/read files directly from remote storage-reducing pressure on local disks and making scalability easier.

  Key capabilities:
  - AWS S3 Supported
  - DigitalOcean Spaces Supported
  - S3-compatible Depends on the endpoint

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - external-account
  - paid-service
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_alternative_file_system#readme
  issues: https://github.com/EduardoKrausME/moodle-local_alternative_file_system/issues
YAML,
    ],
    'mod_cloudstudio' => [
        'path' => 'mod/cloudstudio',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for mod_cloudstudio.

name: "Cloud Studio"
summary: "Complete activity for publishing and managing cloud-hosted videos."
description: |
  Complete activity for publishing and managing cloud-hosted videos.

  The most notable feature of the Moodle mod_cloudstudio is the use of artificial intelligence to convert videos into books and mind maps. This technology not only facilitates the understanding of content but also promotes a more visual and structured learning experience. Additionally, the system offers automatic suggestions for creating quizzes, shorts (short videos), and new videos, helping instructors diversify and enrich the educational material.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - external-account
  - paid-service
category: "video"
links:
  docs: https://github.com/eadtech-moodle/moodle-mod_cloudstudio#readme
  issues: https://github.com/eadtech-moodle/moodle-mod_cloudstudio/issues
YAML,
    ],
    'local_kopere_mobile' => [
        'path' => 'local/kopere_mobile',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_kopere_mobile.

name: "Kopere APP Mobile"
summary: "Integrations and features that bring a mobile experience to your platform."
description: |
  Integrations and features that bring a mobile experience to your platform.

  This plugin provides integration with an exclusive application. By Christmas, I will share the instructions here for downloading the APK.

  Supported Moodle versions in the supplied plugin list: 3.11 - 5.0.

labels:
  - fully-free
category: "integrations"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_kopere_mobile#readme
  issues: https://github.com/EduardoKrausME/moodle-local_kopere_mobile/issues
YAML,
    ],
    'local_copy' => [
        'path' => 'local/copy',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_copy.

name: "Copy and Paste Modules"
summary: "Copy and paste activities and resources between courses with just a few clicks."
description: |
  Copy and paste activities and resources between courses with just a few clicks.

  This plugin that provides a practical and efficient functionality to copy activities or resources from one course and paste them into another, making it easier to reuse content across different courses.

  Key capabilities:
  - Copy activities or resources from any Moodle course.
  - Paste the copied items into any other Moodle course.
  - Compatible with all types of modules, including quizzes, forums, SCORM, and more.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_copy#readme
  issues: https://github.com/EduardoKrausME/moodle-local_copy/issues
YAML,
    ],
    'media_cloudstudio' => [
        'path' => 'media/player/cloudstudio',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for media_cloudstudio.

name: "CloudStudio Filter Player"
summary: "Automatically embed CloudStudio videos in text and pages."
description: |
  Automatically embed CloudStudio videos in text and pages.

  The Moodle Media CloudStudio integrates the CloudStudio player into any area of Moodle, providing a simple and efficient way to embed CloudStudio videos in pages, activities, and other resources.

  Key capabilities:
  - Embed CloudStudio videos in any Moodle area.
  - Responsive and customizable player.
  - Support for advanced playback settings.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - external-account
  - paid-service
category: "video"
links:
  docs: https://github.com/eadtech-moodle/moodle-media_cloudstudio#readme
  issues: https://github.com/eadtech-moodle/moodle-media_cloudstudio/issues
YAML,
    ],
    'repository_cloudstudio' => [
        'path' => 'repository/cloudstudio',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for repository_cloudstudio.

name: "CloudStudio File Repository"
summary: "Access your CloudStudio library through the platform file picker."
description: |
  Access your CloudStudio library through the platform file picker.

  The Moodle Media CloudStudio integrates the CloudStudio player into any area of Moodle, providing a simple and efficient way to embed CloudStudio videos in pages, activities, and other resources.

  Key capabilities:
  - Embed CloudStudio videos in any Moodle area.
  - Responsive and customizable player.
  - Support for advanced playback settings.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - external-account
  - paid-service
category: "integrations"
links:
  docs: https://github.com/eadtech-moodle/moodle-repository_cloudstudio#readme
  issues: https://github.com/eadtech-moodle/moodle-repository_cloudstudio/issues
YAML,
    ],
    'local_boost_dark' => [
        'path' => 'local/boost_dark',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_boost_dark.

name: "Boost Dark"
summary: "Add a refined dark experience to the Boost theme for greater visual comfort."
description: |
  Add a refined dark experience to the Boost theme for greater visual comfort.

  Boost Dark Mode is a Moodle plugin that adds a dark mode button to the Boost theme and its child themes, offering a more comfortable visual experience for users, especially in low-light environments.

  Key capabilities:
  - Activates a dark mode button in the Boost theme header.
  - Saves the user's dark mode preference using their preferences, ensuring settings remain consistent across browsers.
  - Simple and lightweight, with no interference in any standard Boost functionality.

  Supported Moodle versions in the supplied plugin list: 4.0 - 5.0.

labels:
  - fully-free
category: "themes"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_boost_dark#readme
  issues: https://github.com/EduardoKrausME/moodle-local_boost_dark/issues
YAML,
    ],
    'local_kopere_bi' => [
        'path' => 'local/kopere_bi',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_kopere_bi.

name: "Kopere BI"
summary: "More than 100 dashboards and reports for intelligent data management."
description: |
  More than 100 dashboards and reports for intelligent data management.

  Kopere BI is a reporting and dashboard plugin for Moodle with more than 100 ready-to-use reports .

  Key capabilities:
  - Students 9 reports
  - Courses and content 16 reports
  - Login reports 2 reports

  Supported Moodle versions in the supplied plugin list: 3.11 - 5.0.

labels:
  - fully-free
category: "reports"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_kopere_bi#readme
  issues: https://github.com/EduardoKrausME/moodle-local_kopere_bi/issues
YAML,
    ],
    'block_rate' => [
        'path' => 'blocks/rate',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for block_rate.

name: "Star Rating"
summary: "Collect quick star ratings and track student feedback."
description: |
  Collect quick star ratings and track student feedback.

  This plugin is a Moodle block that provides a rating system, allowing users to rate courses with a score from 1 to 5 stars. The average rating is displayed directly in the block.

  Key capabilities:
  - Star Rating System : Users can rate courses with up to 5 stars. The average rating is displayed in the block.
  - Users can rate courses with up to 5 stars.
  - The average rating is displayed in the block.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "reports"
links:
  docs: https://github.com/EduardoKrausME/moodle-block_rate#readme
  issues: https://github.com/EduardoKrausME/moodle-block_rate/issues
YAML,
    ],
    'profilefield_database' => [
        'path' => 'user/profile/field/database',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for profilefield_database.

name: "User Field DB"
summary: "Create profile fields connected to information stored in the database."
description: |
  Create profile fields connected to information stored in the database.

  This plugin allows Moodle administrators to create user profile fields filled with data from a database table. By using this plugin, administrators can create data tables that students can select from and automatically generate reports in Kopere BI.

  Key capabilities:
  - Create user profile fields linked to database tables.
  - Define categories of data stored in the database.
  - Allow users to select predefined data when editing their profile.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-profilefield_database#readme
  issues: https://github.com/EduardoKrausME/moodle-profilefield_database/issues
YAML,
    ],
    'local_backupftp' => [
        'path' => 'local/backupftp',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_backupftp.

name: "Moodle Course Backup"
summary: "Automate course backups and securely send them to external servers."
description: |
  Automate course backups and securely send them to external servers.

  This is a Moodle plugin that facilitates the backup and restoration process of courses. The plugin performs backups of Moodle courses and automatically transfers them to a configured FTP server, as well as organizes the backups by Moodle categories, making backup management more efficient. The plugin also offers a tool to restore courses directly from the FTP server.

  Key capabilities:
  - Course backup: Performs backup of courses in Moodle and automatically sends them to the FTP.
  - Category organization: Organizes backups on the FTP server by course categories, simplifying management.
  - Course restoration: Allows restoration of courses directly from backups stored on the FTP server.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_backupftp#readme
  issues: https://github.com/EduardoKrausME/moodle-local_backupftp/issues
YAML,
    ],
    'mod_pdfprotect' => [
        'path' => 'mod/pdfprotect',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for mod_pdfprotect.

name: "PDF Protect"
summary: "Publish PDF documents with additional protection and control features."
description: |
  Publish PDF documents with additional protection and control features.

  This is a Moodle module developed to provide an extra layer of security for PDF files, preventing users from downloading, printing, or copying the content of the PDF. It is ideal for protecting sensitive material and preventing unauthorized sharing of documents.

  Key capabilities:
  - Download Protection : Prevents downloading the PDF file.
  - Print Block : Disables the print option for the PDF.
  - Prevent Text Copying : Blocks copying content from the PDF, ensuring that the content cannot be easily copied.

  Supported Moodle versions in the supplied plugin list: 4.0 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-mod_pdfprotect#readme
  issues: https://github.com/EduardoKrausME/moodle-mod_pdfprotect/issues
YAML,
    ],
    'media_supervideo' => [
        'path' => 'media/player/supervideo',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for media_supervideo.

name: "SuperVideo Filter Player"
summary: "Play video links using the modern SuperVideo player."
description: |
  Play video links using the modern SuperVideo player.

  This is a filter for Moodle that automatically transforms video links hosted on the platform into beautiful players, just like SuperVideo .

  Key capabilities:
  - Navigate to: Site Administration > Plugins > Filters > Media SuperVideo .
  - Adjust the settings according to your Moodle environment's needs.
  - Automatic Player: Automatically converts video links into integrated players.

  Supported Moodle versions in the supplied plugin list: 3.8 - 5.0.

labels:
  - fully-free
category: "video"
links:
  docs: https://github.com/EduardoKrausME/moodle-media_supervideo#readme
  issues: https://github.com/EduardoKrausME/moodle-media_supervideo/issues
YAML,
    ],
    'repository_ottflix' => [
        'path' => 'repository/ottflix',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for repository_ottflix.

name: "OttFlix Repository"
summary: "Select OttFlix videos directly through the file repository."
description: |
  Select OttFlix videos directly through the file repository.

  OttFlix is an innovative solution that not only stores videos and audios but also converts these contents into interactive H5P formats, providing a richer and more engaging learning experience.

  Key capabilities:
  - Interactive Book Create an interactive book with various content such as videos, glossaries, quizzes, drag-and-drop activities, crossword puzzles, and more. Add a summary at the end, showing the student's score.
  - Interactive Video Create interactive videos with chapters, glossaries, and summaries to reinforce learning.
  - Digital Book Organize content into chapters in an engaging way to create a cohesive and interactive digital book.

  Supported Moodle versions in the supplied plugin list: 4.0 - 5.0.

labels:
  - external-account
  - paid-service
category: "integrations"
links:
  docs: https://github.com/EduardoKrausME/moodle-repository_ottflix#readme
  issues: https://github.com/EduardoKrausME/moodle-repository_ottflix/issues
YAML,
    ],
    'media_ottflix' => [
        'path' => 'media/player/ottflix',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for media_ottflix.

name: "OttFlix Filter Player"
summary: "Embed OttFlix videos in content with secure automatic playback."
description: |
  Embed OttFlix videos in content with secure automatic playback.

  OttFlix is an innovative solution that not only stores videos and audios but also converts these contents into interactive H5P formats, providing a richer and more engaging learning experience.

  Key capabilities:
  - Interactive Book Create an interactive book with various content such as videos, glossaries, quizzes, drag-and-drop activities, crossword puzzles, and more. Add a summary at the end, showing the student's score.
  - Interactive Video Create interactive videos with chapters, glossaries, and summaries to reinforce learning.
  - Digital Book Organize content into chapters in an engaging way to create a cohesive and interactive digital book.

  Supported Moodle versions in the supplied plugin list: 4.0 - 5.0.

labels:
  - external-account
  - paid-service
category: "video"
links:
  docs: https://github.com/EduardoKrausME/moodle-media_ottflix#readme
  issues: https://github.com/EduardoKrausME/moodle-media_ottflix/issues
YAML,
    ],
    'local_helpdesk' => [
        'path' => 'local/helpdesk',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_helpdesk.

name: "Helpdesk and Knowledge Base"
summary: "Integrated help desk and knowledge base for the platform."
description: |
  Integrated help desk and knowledge base for the platform.

  This plugin provides a ticketing system for managing support requests. It allows users to create and track tickets while enabling administrators and support teams to manage and respond efficiently.

  Key capabilities:
  - Creation and management of support tickets by users.
  - Categorization of tickets for better organization.
  - Assignment of users to specific categories to respond to tickets.

  Supported Moodle versions in the supplied plugin list: 4.1 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_helpdesk#readme
  issues: https://github.com/EduardoKrausME/moodle-local_helpdesk/issues
YAML,
    ],
    'theme_eadflix' => [
        'path' => 'theme/eadflix',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for theme_eadflix.

name: "EadFlix"
summary: "Immersive streaming-inspired theme designed to showcase your courses."
description: |
  Immersive streaming-inspired theme designed to showcase your courses.

  At EadFlix, we believe in free education that is accessible to all, visually engaging in both content and design.

  Key capabilities:
  - Integration with VLibras for automatic translation into Brazilian Sign Language (Libras) - Portuguese (Brazil) only
  - Text resizing and contrast adjustments
  - Letter and line spacing customization

  Supported Moodle versions in the supplied plugin list: 4.0 - 5.0.

labels:
  - fully-free
category: "themes"
links:
  docs: https://github.com/EduardoKrausME/moodle-theme_eadflix#readme
  issues: https://github.com/EduardoKrausME/moodle-theme_eadflix/issues
YAML,
    ],
    'mod_pandavideo' => [
        'path' => 'mod/pandavideo',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for mod_pandavideo.

name: "Panda Video"
summary: "Activity with secure playback, progress tracking, and completion for Panda videos."
description: |
  Activity with secure playback, progress tracking, and completion for Panda videos.

  Key capabilities:
  - Allows you to add Panda Video videos as activities in Moodle.
  - Supports tokens and secure URLs (using expiring query strings or authentication).
  - Integration with Panda Video's player directly within the course.

  Supported Moodle versions in the supplied plugin list: 3.10 - 5.0.

labels:
  - external-account
  - paid-service
category: "video"
links:
  docs: https://github.com/panda-moodle/moodle-mod_pandavideo#readme
  issues: https://github.com/panda-moodle/moodle-mod_pandavideo/issues
YAML,
    ],
    'media_pandavideo' => [
        'path' => 'media/player/pandavideo',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for media_pandavideo.

name: "Panda Video Filter Player"
summary: "Turn Panda Video links into players embedded in content."
description: |
  Turn Panda Video links into players embedded in content.

  This plugin allows you to quickly insert videos hosted on Panda Video into any Moodle content area (labels, pages, books, forums, etc.) using the Moodle editor's media icon.

  Key capabilities:
  - Automatically transforms Panda Video links into embedded players.
  - Easy to use: just paste the Panda Video link and you're done!
  - Works with the standard Moodle text editor media button.

  Supported Moodle versions in the supplied plugin list: 3.10 - 5.0.

labels:
  - external-account
  - paid-service
category: "video"
links:
  docs: https://github.com/panda-moodle/moodle-media_pandavideo#readme
  issues: https://github.com/panda-moodle/moodle-media_pandavideo/issues
YAML,
    ],
    'repository_pandavideo' => [
        'path' => 'repository/pandavideo',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for repository_pandavideo.

name: "Panda Video Repository"
summary: "Find and add your Panda Video library through the file picker."
description: |
  Find and add your Panda Video library through the file picker.

  Requires the mod_pandavideo and media_pandavideo plugins to be installed and configured. ' An API key must be configured in mod_pandavideo for proper functionality.

  Key capabilities:
  - When creating or editing an activity, browse the repositories and select a video from your Panda Video account.
  - The media_pandavideo plugin will automatically generate and display the video player in the configured location.

  Supported Moodle versions in the supplied plugin list: 3.10 - 5.0.

labels:
  - external-account
  - paid-service
category: "integrations"
links:
  docs: https://github.com/panda-moodle/moodle-repository_pandavideo#readme
  issues: https://github.com/panda-moodle/moodle-repository_pandavideo/issues
YAML,
    ],
    'theme_eadtraining' => [
        'path' => 'theme/eadtraining',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for theme_eadtraining.

name: "Ead Training"
summary: "Clean, accessible academic theme packed with customization options."
description: |
  Clean, accessible academic theme packed with customization options.

  At Ead Training, we believe in free education that is accessible to everyone, visually appealing in both content and design.

  Key capabilities:
  - Integration with VLibras for automatic translation into Brazilian Sign Language (only for Brazilian Portuguese)
  - Text resizing and contrast options
  - Adjustable letter and line spacing

  Supported Moodle versions in the supplied plugin list: 4.0 - 5.0.

labels:
  - fully-free
category: "themes"
links:
  docs: https://github.com/EduardoKrausME/moodle-theme_eadtraining#readme
  issues: https://github.com/EduardoKrausME/moodle-theme_eadtraining/issues
YAML,
    ],
    'local_kopere_status' => [
        'path' => 'local/kopere_status',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_kopere_status.

name: "System Status"
summary: "Monitor services, availability, and technical indicators in real time."
description: |
  Monitor services, availability, and technical indicators in real time.

  Public status page for your Moodle: monitors availability, uptime, consecutive days, and history - with a public URL to share.

  Key capabilities:
  - Moodle availability monitoring (heartbeat/checks).
  - Continuous uptime since the last outage.
  - Consecutive days online (streak) for executive reporting.

  Supported Moodle versions in the supplied plugin list: 4.1 - 5.0.

labels:
  - fully-free
category: "reports"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_kopere_status#readme
  issues: https://github.com/EduardoKrausME/moodle-local_kopere_status/issues
YAML,
    ],
    'local_slow_queries' => [
        'path' => 'local/slow_queries',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_slow_queries.

name: "Slow Queries"
summary: "Identify slow queries and find opportunities to improve performance."
description: |
  Identify slow queries and find opportunities to improve performance.

  local_slow_queries is an admin-only plugin that turns your mdl_log_queries table into a practical UI to find, triage and analyze slow SQL statements executed by Moodle.

  Key capabilities:
  - List & filter slow queries quickly (default exectime > 3s ).
  - Open details with SQL + parameters and a ready-to-use ChatGPT prompt including table schemas.
  - Use dashboards to see patterns: top slowest, recurrence, distribution, CRON vs WEB, by qtype, and errors.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "reports"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_slow_queries#readme
  issues: https://github.com/EduardoKrausME/moodle-local_slow_queries/issues
YAML,
    ],
    'message_kopereemail' => [
        'path' => 'message/output/kopereemail',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for message_kopereemail.

name: "Kopere Email"
summary: "Email messaging channel with additional communication features."
description: |
  Email messaging channel with additional communication features.

  message_kopereemail is a Moodle message output based on message_email , built to deliver consistent, branded emails - while still letting you create fully custom HTML per notification type.

  Key capabilities:
  - If fullmessagehtml exists ' apply wrapper.
  - If it doesn't ' create simple HTML from text, then apply wrapper (if configured).
  - Copies existing config from message/email into message_kopereemail .

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "integrations"
links:
  docs: https://github.com/EduardoKrausME/moodle-message_kopereemail#readme
  issues: https://github.com/EduardoKrausME/moodle-message_kopereemail/issues
YAML,
    ],
    'mod_childcourse' => [
        'path' => 'mod/childcourse',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for mod_childcourse.

name: "Child Course"
summary: "Organize related courses and present access to child courses as an activity."
description: |
  Organize related courses and present access to child courses as an activity.

  mod_childcourse adds a Moodle activity that works as a shortcut inside a parent course . When clicked, the user is redirected to a child course and (optionally) the plugin performs automatic enrolment , group mapping, and incremental synchronization of completion and grades .

  Key capabilities:
  - Supports Backup/Restore .
  - Can hide the child course from "My courses / Overview" to reduce clutter.
  - On delete, choose whether to unenrol link-enrolled users or keep enrolments.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-mod_childcourse#readme
  issues: https://github.com/EduardoKrausME/moodle-mod_childcourse/issues
YAML,
    ],
    'mod_scicalc' => [
        'path' => 'mod/scicalc',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for mod_scicalc.

name: "Scientific Calculator"
summary: "Scientific calculator available as an activity within courses."
description: |
  Scientific calculator available as an activity within courses.

  This is a Moodle activity module that adds a clean, fast, scientific calculator directly inside your course - perfect for math, physics, engineering, finance, and STEM training where students need a reliable tool without leaving the LMS.

  Key capabilities:
  - Type an expression ' press Enter or = .
  - Functions insert as sin( , sqrt( , pow( to speed up usage.
  - History items are clickable ' reuse results instantly.

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "integrations"
links:
  docs: https://github.com/EduardoKrausME/moodle-mod_scicalc#readme
  issues: https://github.com/EduardoKrausME/moodle-mod_scicalc/issues
YAML,
    ],
    'local_kopere_sitemap' => [
        'path' => 'local/kopere_sitemap',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_kopere_sitemap.

name: "Public Sitemap"
summary: "Generate an organized public sitemap to improve navigation and discovery."
description: |
  Generate an organized public sitemap to improve navigation and discovery.

  local_kopere_sitemap is a Moodle plugin that automatically generates a public XML sitemap for the site and adds a reference to the sitemap in the <head> of all Moodle pages.

  Key capabilities:
  - XML Sitemap Generator
  - Automatic injection of the sitemap link into the site's <head>
  - loc ' public URL

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "administration"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_kopere_sitemap#readme
  issues: https://github.com/EduardoKrausME/moodle-local_kopere_sitemap/issues
YAML,
    ],
    'local_kopere_wpbridge' => [
        'path' => 'local/kopere_wpbridge',
        'listing' => <<<'YAML'
# (RFC §4.1). Authors update their listing with an ordinary commit; camp
# ingests and hash-pins it at each tagged release. Listing for local_kopere_wpbridge.

name: "Kopere WP Bridge"
summary: "Connect the platform to WordPress and simplify workflows between the systems."
description: |
  Connect the platform to WordPress and simplify workflows between the systems.

  Key capabilities:
  - Map WooCommerce product IDs to Moodle courses
  - Map WooCommerce product IDs to Moodle cohorts
  - Receive order webhooks with token validation

  Supported Moodle versions in the supplied plugin list: 3.9 - 5.0.

labels:
  - fully-free
category: "integrations"
links:
  docs: https://github.com/EduardoKrausME/moodle-local_kopere_wpbridge#readme
  issues: https://github.com/EduardoKrausME/moodle-local_kopere_wpbridge/issues
YAML,
    ],
];

$created = 0;
$skipped = 0;
$failed = 0;

foreach ($plugins as $component => $plugin) {
    $pluginroot = $moodleroot . "/" . $plugin["path"];

    if (!is_dir($pluginroot)) {
        fwrite(STDOUT, "[SKIP] {$component}: folder not found at {$pluginroot}\n");
        $skipped++;
        continue;
    }

    $files = [
        ".github/workflows/camp-release.yml" => $workflow,
        ".camp/listing.yml" => $plugin["listing"],
    ];

    $pluginfailed = false;
    foreach ($files as $relativepath => $content) {
        $target = $pluginroot . "/" . $relativepath;
        $directory = dirname($target);

        if (!is_dir($directory) && !mkdir($directory, 0777, true) && !is_dir($directory)) {
            fwrite(STDERR, "[ERROR] {$component}: unable to create {$directory}\n");
            $pluginfailed = true;
            continue;
        }

        if (file_put_contents($target, rtrim($content, "\n") . "\n") === false) {
            fwrite(STDERR, "[ERROR] {$component}: unable to write {$target}\n");
            $pluginfailed = true;
        }
    }

    if ($pluginfailed) {
        $failed++;
        continue;
    }

    $command = "git -C " . escapeshellarg($pluginroot)
        . " add -- .github/workflows/camp-release.yml .camp/listing.yml 2>&1";
    $output = [];
    $exitcode = 0;
    exec($command, $output, $exitcode);

    if ($exitcode !== 0) {
        fwrite(STDERR, "[ERROR] {$component}: git add failed\n");
        if ($output) {
            fwrite(STDERR, implode("\n", $output) . "\n");
        }
        $failed++;
        continue;
    }

    fwrite(STDOUT, "[OK] {$component}: files created and added to Git\n");
    $created++;
}

fwrite(STDOUT, "\nCreated: {$created}; skipped: {$skipped}; failed: {$failed}.\n");
exit($failed > 0 ? 1 : 0);


